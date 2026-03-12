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

  // Add this inside BookingService class
  async verifyByClerk(bookingId) {
    // 1. Fetch the booking
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    // 2. State Machine Check: Ensure it is actually waiting for the Clerk
    if (booking.status !== "PENDING_CLERK_REVIEW") {
      throw new AppError(
        `Cannot verify. Current status is ${booking.status}.`,
        400,
      );
    }

    // 3. Check for overlapping dates just to be completely safe
    const isOverlap = await this.bookingRepository.checkFacilityOverlap(
      booking.facilityId,
      booking.startTime,
      booking.endTime,
      booking.id,
    );

    if (isOverlap) {
      throw new AppError(
        "These dates are already booked or pending payment for this facility.",
        409,
      );
    }

    // 4. Update the status and move it to the Admin's queue
    booking.status = "PENDING_ADMIN_APPROVAL";
    await booking.save();

    return booking;
  }

  // Add this inside BookingService class
  async approveByAdmin(bookingId, advanceAmount) {
    // 1. Fetch the booking
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    // 2. State Machine Check: Ensure it is actually waiting for Admin approval
    if (booking.status !== "PENDING_ADMIN_APPROVAL") {
      throw new AppError(
        `Cannot approve. Current status is ${booking.status}.`,
        400,
      );
    }

    // 3. Update the status to wait for user payment
    booking.status = "PENDING_ADVANCE_PAYMENT";

    // 4. Set the advance payment required.
    // If the admin doesn't explicitly pass an amount, default to the facility's standard security deposit.
    booking.advanceAmountRequested = advanceAmount || booking.securityDeposit;

    await booking.save();

    return booking;
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
