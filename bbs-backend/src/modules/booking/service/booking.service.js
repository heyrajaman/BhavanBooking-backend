// src/modules/booking/service/booking.service.js
import { BookingRepository } from "../repository/booking.repository.js";
import { FacilityRepository } from "../../facility/repository/facility.repository.js";
import { AppError } from "../../../utils/AppError.js";

export class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.facilityRepository = new FacilityRepository();
  }

  async createBooking(userId, bookingData) {
    // 1. Fetch the requested facility to access its specific pricing and deposit rules
    const facility = await this.facilityRepository.findById(
      bookingData.facilityId,
    );
    if (!facility) {
      throw new AppError(
        "The requested facility or package does not exist.",
        404,
      );
    }

    // 2. Calculate the total cost dynamically based on the facility's pricing structure
    const calculatedAmount = this._calculatePrice(
      facility,
      bookingData.startTime,
      bookingData.endTime,
    );

    // 3. Create the booking in the database
    // The status automatically defaults to "PENDING_CLERK_REVIEW"
    const newBooking = await this.bookingRepository.create({
      userId,
      facilityId: facility.id,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      eventType: bookingData.eventType,
      guestCount: bookingData.guestCount,
      calculatedAmount,
      securityDeposit: facility.securityDeposit,
    });

    return newBooking;
  }

  /**
   * Gets unavailable dates for a facility to block out frontend calendar days.
   */
  async getUnavailableDates(facilityId) {
    // 1. Fetch the active bookings from the repository
    const activeBookings =
      await this.bookingRepository.findActiveBookingsForFacility(facilityId);

    // 2. Map the database results into a clean array of start/end objects for the frontend
    return activeBookings.map((booking) => ({
      start: booking.startTime,
      end: booking.endTime,
      // Optional: Passing status lets the frontend show "Pending" vs "Confirmed" in different colors if they want
      status: booking.status,
    }));
  }

  /**
   * Checks if requested dates are available and returns a price quote.
   */
  async checkAvailabilityAndPrice(facilityId, startTime, endTime) {
    // 1. Fetch the facility to ensure it exists and get its pricing rules
    const facility = await this.facilityRepository.findById(facilityId);
    if (!facility) {
      throw new AppError("Facility not found.", 404);
    }

    // 2. Check if the dates are already booked
    const isOverlap = await this.bookingRepository.checkFacilityOverlap(
      facilityId,
      startTime,
      endTime,
    );

    if (isOverlap) {
      return {
        isAvailable: false,
        message: "These dates are currently unavailable for this facility.",
      };
    }

    // 3. If available, calculate the exact price they will pay using your pricing engine
    const calculatedAmount = this._calculatePrice(facility, startTime, endTime);

    return {
      isAvailable: true,
      message: "Dates are available!",
      pricing: {
        baseCalculatedAmount: calculatedAmount,
        securityDepositRequired: facility.securityDeposit,
        estimatedTotal:
          Number(calculatedAmount) + Number(facility.securityDeposit),
      },
    };
  }

  /**
   * Internal calculation engine to parse the JSON pricing rules
   */
  _calculatePrice(facility, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = Math.abs(end - start) / 36e5; // Convert milliseconds to hours
    const durationDays = Math.ceil(durationHours / 24);

    const details = facility.pricingDetails;
    let total = Number(facility.baseRate);

    switch (facility.pricingType) {
      case "TIERED":
        // Handles Complete Bhavan (1-day, 2-day, 3-day pricing)
        if (details && durationDays === 1 && details["1_day"])
          total = details["1_day"];
        else if (details && durationDays === 2 && details["2_days"])
          total = details["2_days"];
        else if (details && durationDays >= 3 && details["3_days"]) {
          // Caps at the 3-day rate, adding base rate for any additional days
          total =
            details["3_days"] + (durationDays - 3) * Number(facility.baseRate);
        }
        break;

      case "HOURLY":
        // Handles Meeting Hall (Base 5 hours + extra hourly rate)
        if (details && details.base_hours && details.extra_hour_rate) {
          if (durationHours > details.base_hours) {
            const extraHours = Math.ceil(durationHours - details.base_hours);
            total += extraHours * details.extra_hour_rate;
          }
        } else {
          total = durationHours * total; // Standard hourly fallback
        }
        break;

      case "SLOT":
        // Handles Dining Hall (Half-day <= 8 hrs vs Full-day)
        if (details && details.half_day && details.full_day) {
          total = durationHours <= 8 ? details.half_day : details.full_day;
        } else if (details && details.duration_hours) {
          // Handles the 6-hour Main Hall package. Charges for a new slot if they exceed 6 hours.
          total = Math.ceil(durationHours / details.duration_hours) * total;
        }
        break;

      case "FIXED":
      case "PER_ITEM":
      default:
        // Fixed packages (Lawn) or Per Item (Day Rooms, Mattresses) apply the base rate flatly.
        break;
    }

    return total;
  }
}
