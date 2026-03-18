// src/modules/booking/service/booking.service.js
import { BookingRepository } from "../repository/booking.repository.js";
import { FacilityRepository } from "../../facility/repository/facility.repository.js";
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";

export class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.facilityRepository = new FacilityRepository();
    this.notificationService = new NotificationService();
  }

  async createBooking(userId, bookingData) {
    const { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails } =
      await this._processAndValidateBookingItems(bookingData);

    const newBooking = await this.bookingRepository.create({
      userId,
      facilityId: mainFacilityId, // Null if entirely custom, or main ID if package
      customDetails: customDetails, // Stores the JSON array of ticked boxes
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      eventType: bookingData.eventType,
      guestCount: bookingData.guestCount,
      calculatedAmount: totalAmount,
      securityDeposit: totalSecurityDeposit,
    });

    return { newBooking };
  }

  // Replace your existing getUnavailableDates method with this:
  async getUnavailableDates(facilityId) {
    // 1. Get the facility the calendar is trying to load
    const targetFacility = await this.facilityRepository.findById(facilityId);
    if (!targetFacility) throw new AppError("Facility not found.", 404);

    // 2. Fetch ALL upcoming bookings across the entire system
    const allUpcomingBookings =
      await this.bookingRepository.findAllUpcomingActiveBookings();

    const blockedDates = [];

    // 3. Loop through every booking and check if it conflicts with our target facility
    allUpcomingBookings.forEach((booking) => {
      let isConflict = false;

      // --- CASE A: The existing booking is a Custom Tick-Box Booking ---
      if (booking.customDetails && booking.customDetails.length > 0) {
        // Did they directly book our target facility?
        const hasTarget = booking.customDetails.some(
          (item) => item.name === targetFacility.name,
        );

        // Did they book a component that belongs inside our target package?
        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        const blocksPackage = targetInclusions.some((inc) =>
          booking.customDetails.some((item) => item.name === inc),
        );

        // Note: For rooms, we don't fully block the calendar unless all rooms are taken.
        // For now, we block it if it's not a ROOM type.
        if (
          (hasTarget || blocksPackage) &&
          targetFacility.facilityType !== "ROOM"
        ) {
          isConflict = true;
        }
      }

      // --- CASE B: The existing booking is a Standard Package/Hall ---
      if (booking.facility) {
        // 1. Is it the exact same facility?
        if (booking.facility.id === targetFacility.id) isConflict = true;

        // 2. Does the booked package contain our target facility?
        const bookedInclusions =
          booking.facility.pricingDetails?.included_facilities || [];
        if (bookedInclusions.includes(targetFacility.name)) isConflict = true;

        // 3. Does our target package contain the booked package?
        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        if (targetInclusions.includes(booking.facility.name)) isConflict = true;

        // 4. Do the two packages share a common sub-component? (e.g., both use the Kitchen)
        const sharedComponents = targetInclusions.filter((inc) =>
          bookedInclusions.includes(inc),
        );
        if (sharedComponents.length > 0) isConflict = true;

        // Allow multiple room bookings to overlap on the calendar visually
        if (isConflict && targetFacility.facilityType === "ROOM") {
          isConflict = false;
        }
      }

      // If a conflict is found, push these dates to the calendar block-out list
      if (isConflict) {
        blockedDates.push({
          start: booking.startTime,
          end: booking.endTime,
          status: booking.status,
        });
      }
    });

    return blockedDates;
  }

  async checkAvailabilityAndPrice(bookingData) {
    try {
      // 1. Check if they are trying to book a standard Package
      if (bookingData.facilityId) {
        const facility = await this.facilityRepository.findById(
          bookingData.facilityId,
        );
        if (!facility) throw new AppError("Facility not found.", 404);

        // Fetch overlaps to see what is taken
        const overlaps = await this.bookingRepository.findOverlappingBookings(
          bookingData.startTime,
          bookingData.endTime,
        );
        let unavailableFacilities = new Set();

        overlaps.forEach((booking) => {
          if (booking.customDetails)
            booking.customDetails.forEach((item) =>
              unavailableFacilities.add(item.name),
            );
          if (booking.facility) {
            unavailableFacilities.add(booking.facility.name);
            if (booking.facility.pricingDetails?.included_facilities) {
              booking.facility.pricingDetails.included_facilities.forEach(
                (inc) => unavailableFacilities.add(inc),
              );
            }
          }
        });

        // 2. Check if the package is entirely blocked or partially blocked
        const packageInclusions =
          facility.pricingDetails?.included_facilities || [];
        let takenComponents = [];
        let availableComponents = [];

        packageInclusions.forEach((inc) => {
          if (unavailableFacilities.has(inc)) {
            takenComponents.push(inc);
          } else {
            availableComponents.push(inc);
          }
        });

        // 3. If there are conflicts inside the package, return the PARTIAL availability response!
        if (takenComponents.length > 0) {
          // Fetch the database IDs of the remaining available items so the frontend can easily book them
          const availableFacilitiesDb = await this.facilityRepository.findAll({
            name: takenComponents.length > 0 ? availableComponents : [],
          });

          // Filter our DB results to match only the available names
          const availableToBook = availableFacilitiesDb
            .filter((f) => availableComponents.includes(f.name))
            .map((f) => ({
              facilityId: f.id,
              name: f.name,
              baseRate: f.baseRate,
              quantity: 1, // Default quantity to 1
            }));

          return {
            isAvailable: false,
            isPartiallyAvailable: true,
            message: `The full package is unavailable because ${takenComponents.join(", ")} is already booked. You can book the remaining facilities individually.`,
            unavailableComponents: takenComponents,
            availableAlternatives: availableToBook,
          };
        }
      }

      // 4. If everything is fully available (or it's a Custom booking check), proceed as normal
      const { totalAmount, totalSecurityDeposit } =
        await this._processAndValidateBookingItems(bookingData);

      return {
        isAvailable: true,
        isPartiallyAvailable: false,
        message: "Dates are completely available!",
        pricing: {
          baseCalculatedAmount: totalAmount,
          securityDepositRequired: totalSecurityDeposit,
          estimatedTotal: Number(totalAmount) + Number(totalSecurityDeposit),
        },
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        return {
          isAvailable: false,
          isPartiallyAvailable: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  async getMyBookings(userId) {
    return await this.bookingRepository.findAll({ userId });
  }

  // --- CORE LOGIC ENGINE ---
  async _processAndValidateBookingItems(bookingData) {
    let totalAmount = 0;
    let totalSecurityDeposit = 0;
    let mainFacilityId = bookingData.facilityId || null;
    let customDetails = null;

    // 1. Fetch all overlaps to build a "Set" of unavailable facility names
    const overlaps = await this.bookingRepository.findOverlappingBookings(
      bookingData.startTime,
      bookingData.endTime,
    );
    let unavailableFacilities = new Set();

    overlaps.forEach((booking) => {
      // If they booked custom items, block those specific names
      if (booking.customDetails) {
        booking.customDetails.forEach((item) =>
          unavailableFacilities.add(item.name),
        );
      }
      // If they booked a standard package/hall, block its name and all its sub-components
      if (booking.facility) {
        unavailableFacilities.add(booking.facility.name);
        if (booking.facility.pricingDetails?.included_facilities) {
          booking.facility.pricingDetails.included_facilities.forEach((inc) =>
            unavailableFacilities.add(inc),
          );
        }
      }
    });

    // 2. Process Custom Checkbox Mode
    if (
      bookingData.customFacilities &&
      bookingData.customFacilities.length > 0
    ) {
      customDetails = [];

      for (const item of bookingData.customFacilities) {
        const fac = await this.facilityRepository.findById(item.facilityId);
        if (!fac)
          throw new AppError(`Facility ID ${item.facilityId} not found.`, 404);

        // Conflict check for custom item
        if (
          unavailableFacilities.has(fac.name) &&
          fac.facilityType !== "ROOM"
        ) {
          // Note: Rooms are excluded from strict blocking here to allow multiple people to book different rooms.
          // You can add stricter inventory limits later.
          throw new AppError(
            `${fac.name} is already booked for these dates.`,
            409,
          );
        }

        const quantity = item.quantity || 1;
        let itemTotal = 0;

        // Multiply PER_ITEM (like Mattresses/Rooms), otherwise calculate standard time
        if (fac.pricingType === "PER_ITEM") {
          itemTotal = Number(fac.baseRate) * quantity;
        } else {
          itemTotal =
            this._calculatePrice(
              fac,
              bookingData.startTime,
              bookingData.endTime,
            ) * quantity;
        }

        totalAmount += itemTotal;
        totalSecurityDeposit += Number(fac.securityDeposit);

        customDetails.push({
          facilityId: fac.id,
          name: fac.name,
          quantity: quantity,
          price: itemTotal,
        });
      }
    }
    // 3. Process Standard Package/Hall Mode
    else if (bookingData.facilityId) {
      const facility = await this.facilityRepository.findById(
        bookingData.facilityId,
      );
      if (!facility) throw new AppError("Facility not found.", 404);

      // Check if the package itself is blocked
      if (unavailableFacilities.has(facility.name)) {
        throw new AppError("This package is unavailable for these dates.", 409);
      }

      // Check if any of the sub-components inside the package are blocked
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

      totalAmount = this._calculatePrice(
        facility,
        bookingData.startTime,
        bookingData.endTime,
      );
      totalSecurityDeposit = facility.securityDeposit;
    }

    return { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails };
  }

  // --- STAFF ACTIONS ---

  async rejectBooking(bookingId) {
    // 1. Fetch the booking using your repository
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    // 2. Prevent rejecting bookings that are already finalized
    const unrejectableStates = [
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "CANCELLED",
      "REJECTED",
    ];
    if (unrejectableStates.includes(booking.status)) {
      throw new AppError(
        `Cannot reject a booking that is currently in ${booking.status} state.`,
        400,
      );
    }

    // 3. Update the status
    booking.status = "REJECTED";
    await booking.save();

    try {
      // Fetch the associated user to get their email and name
      const user = await booking.getUser();

      if (user && user.email) {
        // Fire and forget (no 'await')
        const hardcodedReason =
          "The requested facility/time slot is already booked manually.";

        this.notificationService
          .sendBookingRejectionEmail(
            user.email,
            user.fullName,
            booking.id,
            hardcodedReason,
          )
          .catch((err) =>
            console.error("Rejection email failed to send in background:", err),
          );
      }
    } catch (emailError) {
      console.error("Failed to fetch user for rejection email:", emailError);
    }

    return booking;
  }

  // Update the method signature
  async checkInBooking(bookingId, aadharFileName) {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    if (booking.status !== "CONFIRMED") {
      throw new AppError(
        `Cannot check-in. Booking is currently in ${booking.status} state. It must be CONFIRMED.`,
        400,
      );
    }

    // Update the booking record
    booking.status = "CHECKED_IN";
    booking.actualCheckInTime = new Date();
    booking.aadharImageUrl = aadharFileName;

    await booking.save();

    return booking;
  }

  async checkOutBooking(bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new AppError("Booking not found.", 404);

    // Enforce state machine rules
    if (booking.status !== "CHECKED_IN") {
      throw new AppError(
        `Cannot check-out. Booking is currently in ${booking.status} state. It must be CHECKED_IN.`,
        400,
      );
    }

    booking.status = "CHECKED_OUT";
    // If you add an actualCheckOutTime column to your model, update it here:
    // booking.actualCheckOutTime = new Date();

    await booking.save();

    // NOTE: After checking out, you would typically trigger the BillingService
    // to generate the final invoice for remaining payments.

    return booking;
  }

  _calculatePrice(facility, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = Math.abs(end - start) / 36e5;
    const durationDays = Math.ceil(durationHours / 24) || 1; // Ensure at least 1 day

    const details = facility.pricingDetails;
    let baseRate = Number(facility.baseRate);
    let total = baseRate;

    switch (facility.pricingType) {
      case "TIERED":
        if (details && durationDays === 1 && details["1_day"])
          total = details["1_day"];
        else if (details && durationDays === 2 && details["2_days"])
          total = details["2_days"];
        else if (details && durationDays >= 3 && details["3_days"]) {
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
        if (details && details.half_day && details.full_day) {
          // If it's more than 24 hours, treat it as multiple full days
          if (durationDays > 1) {
            total = durationDays * details.full_day;
          } else {
            total = durationHours <= 8 ? details.half_day : details.full_day;
          }
        } else if (details && details.duration_hours) {
          total = Math.ceil(durationHours / details.duration_hours) * baseRate;
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
