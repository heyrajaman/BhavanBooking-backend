import { AppError } from "../../../utils/AppError.js";
import { validateFacilitySlots } from "../../../utils/timeValidator.js";

export class BookingPricingService {
  constructor({ bookingRepository, facilityService }) {
    this.bookingRepository = bookingRepository;
    this.facilityService = facilityService;
  }

  async processAndValidateBookingItems(bookingData) {
    let totalAmount = 0;
    let totalSecurityDeposit = 0;
    const mainFacilityId = bookingData.facilityId || null;
    let customDetails = null;

    const unavailableFacilities = await this.getUnavailableFacilitiesSet(
      bookingData.startTime,
      bookingData.endTime,
    );

    if (
      bookingData.customFacilities &&
      bookingData.customFacilities.length > 0
    ) {
      customDetails = [];

      for (const item of bookingData.customFacilities) {
        const fac = await this.facilityService.findById(item.facilityId);
        if (!fac) {
          throw new AppError(`Facility ID ${item.facilityId} not found.`, 404);
        }

        validateFacilitySlots(fac, bookingData.startTime, bookingData.endTime);

        if (
          unavailableFacilities.has(fac.name) &&
          fac.facilityType !== "ROOM"
        ) {
          throw new AppError(
            `${fac.name} is already booked for these dates.`,
            409,
          );
        }

        const quantity = item.quantity || 1;
        const itemUnitAmount =
          fac.pricingType === "PER_ITEM"
            ? Number(fac.baseRate)
            : this.calculatePrice(
                fac,
                bookingData.startTime,
                bookingData.endTime,
              );
        const itemTotal = itemUnitAmount * quantity;

        totalAmount += itemTotal;
        totalSecurityDeposit += Number(fac.securityDeposit);

        customDetails.push({
          facilityId: fac.id,
          name: fac.name,
          quantity,
          price: itemTotal,
        });
      }
    } else if (bookingData.facilityId) {
      const facility = await this.facilityService.findById(
        bookingData.facilityId,
      );
      if (!facility) throw new AppError("Facility not found.", 404);

      validateFacilitySlots(
        facility,
        bookingData.startTime,
        bookingData.endTime,
      );

      if (unavailableFacilities.has(facility.name)) {
        throw new AppError("This package is unavailable for these dates.", 409);
      }

      if (facility.pricingDetails?.included_facilities) {
        for (const inc of facility.pricingDetails.included_facilities) {
          if (unavailableFacilities.has(inc)) {
            throw new AppError(
              `Cannot book this package. Component '${inc}' is already booked by someone else.`,
              409,
            );
          }
        }
      }

      totalAmount = this.calculatePrice(
        facility,
        bookingData.startTime,
        bookingData.endTime,
      );
      totalSecurityDeposit = facility.securityDeposit;
    }

    return { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails };
  }

  async getUnavailableFacilitiesSet(startTime, endTime) {
    const overlaps = await this.bookingRepository.findOverlappingBookings(
      startTime,
      endTime,
    );
    const unavailableFacilities = new Set();

    overlaps.forEach((booking) => {
      if (booking.customDetails) {
        booking.customDetails.forEach((item) =>
          unavailableFacilities.add(item.name),
        );
      }

      if (booking.facility) {
        unavailableFacilities.add(booking.facility.name);
        if (booking.facility.pricingDetails?.included_facilities) {
          booking.facility.pricingDetails.included_facilities.forEach((inc) =>
            unavailableFacilities.add(inc),
          );
        }
      }
    });

    return unavailableFacilities;
  }

  calculatePrice(facility, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = Math.abs(end - start) / 36e5;
    const durationDays = Math.ceil(durationHours / 24) || 1;

    const details = facility.pricingDetails;
    const baseRate = Number(facility.baseRate);
    let total = baseRate;

    switch (facility.pricingType) {
      case "TIERED":
        if (details && durationDays === 1 && details["1_day"]) {
          total = details["1_day"];
        } else if (details && durationDays === 2 && details["2_days"]) {
          total = details["2_days"];
        } else if (details && durationDays >= 3 && details["3_days"]) {
          total =
            details["3_days"] + (durationDays - 3) * Number(facility.baseRate);
        } else {
          total = durationDays * baseRate;
        }
        break;
      case "HOURLY":
        if (details && details.base_hours && details.extra_hour_rate) {
          if (durationHours > details.base_hours) {
            const extraHours = Math.ceil(durationHours - details.base_hours);
            total =
              Number(total) + extraHours * Number(details.extra_hour_rate);
          }
        } else {
          total = Math.ceil(durationHours) * baseRate;
        }
        break;
      case "SLOT":
        if (details && details.slotType === "FIXED" && details.slots) {
          const reqStartStr = new Date(startTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const reqEndStr = new Date(endTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const matchedSlot = details.slots.find(
            (s) => s.startTime === reqStartStr && s.endTime === reqEndStr,
          );

          total = matchedSlot ? matchedSlot.price : baseRate;
        } else if (
          details &&
          details.slotType === "FLEXIBLE" &&
          details.durationHours
        ) {
          total = Math.ceil(durationHours / details.durationHours) * baseRate;
        }
        break;
      case "FIXED":
        total = durationDays * baseRate;
        break;
      case "PER_ITEM":
        total = baseRate;
        break;
      default:
        total = durationDays * baseRate;
        break;
    }

    return total;
  }
}
