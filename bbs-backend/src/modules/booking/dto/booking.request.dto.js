// src/modules/booking/dto/booking.request.dto.js

export class CreateBookingDto {
  constructor(data) {
    this.facilityId = data.facilityId;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.eventType = data.eventType;
    this.guestCount = data.guestCount;
  }

  isValid() {
    if (!this.facilityId) throw new Error("Facility ID is required.");
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
