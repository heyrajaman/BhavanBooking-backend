export class CreateBookingRequestDto {
  constructor(data) {
    // We only extract exactly what we need, ignoring any garbage data in req.body
    this.userId = data.userId;
    this.facilityIds = data.facilityIds; // Array of facility IDs they want to book
    this.eventType = data.eventType; // e.g., "Wedding", "Meeting" [cite: 79]
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.guestCount = data.guestCount;
    this.isVegetarianOnly =
      data.isVegetarianOnly !== undefined ? data.isVegetarianOnly : true; // [cite: 124]
    this.isDjProhibited =
      data.isDjProhibited !== undefined ? data.isDjProhibited : true; // [cite: 125]
    this.aadhaarNumber = data.aadhaarNumber; // Mandatory for room guests [cite: 115]
  }

  // We can also add basic validation logic inside the DTO, or use a library like Joi/Zod
  isValid() {
    if (
      !this.userId ||
      !this.facilityIds ||
      !this.eventType ||
      !this.startDate ||
      !this.endDate
    ) {
      throw new Error("Missing required booking fields.");
    }
    // Check if dates are valid
    if (new Date(this.startDate) >= new Date(this.endDate)) {
      throw new Error("End date must be after start date.");
    }

    // FIX: Just ensure it's a valid number greater than 0
    if (!this.guestCount || this.guestCount < 1) {
      throw new Error("Guest count must be at least 1.");
    }
    return true;
  }
}
