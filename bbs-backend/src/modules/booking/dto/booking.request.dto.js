// src/modules/booking/dto/booking.request.dto.js

export class CreateBookingDto {
  constructor(data) {
    this.facilityId = data.facilityId;
    this.customFacilities = data.customFacilities;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.eventType = data.eventType;
    this.guestCount = data.guestCount;
  }

  isValid() {
    // 1. Ensure at least one type of facility is being booked
    if (
      !this.facilityId &&
      (!this.customFacilities || this.customFacilities.length === 0)
    ) {
      throw new Error(
        "Either a main Facility ID or custom facilities must be provided.",
      );
    }

    // 2. Validate custom facilities if they are provided
    if (this.customFacilities && this.customFacilities.length > 0) {
      if (!Array.isArray(this.customFacilities)) {
        throw new Error("Custom facilities must be an array.");
      }
      for (const item of this.customFacilities) {
        if (!item.facilityId) {
          throw new Error(
            "Each custom facility selection must include a facilityId.",
          );
        }
        if (
          !item.quantity ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          throw new Error(
            "Each custom facility selection must have a valid quantity greater than 0.",
          );
        }
      }
    }

    if (!this.startTime || !this.endTime)
      throw new Error("Start and End times are required.");
    if (!this.eventType)
      throw new Error("Event type (e.g., Marriage, Meeting) is required.");
    if (!this.guestCount || this.guestCount <= 0)
      throw new Error("A valid guest count is required.");

    const start = new Date(this.startTime);
    const end = new Date(this.endTime);

    // Ensure valid date formatting
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format. Use ISO 8601 format.");
    }

    // Logical time checks
    if (start >= end) {
      throw new Error("End time must be after the start time.");
    }

    if (start < new Date()) {
      throw new Error("Booking start time cannot be in the past.");
    }

    return true;
  }
}
