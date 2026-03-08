export class CheckInRequestDto {
  constructor(data) {
    this.aadhaarNumber = data?.aadhaarNumber;
    this.guestCount = data?.guestCount;
  }

  isValid() {
    if (!this.aadhaarNumber) {
      throw new Error("Aadhaar number is required for check-in.");
    }

    // Keep the rule simple and strict: if guestCount is provided, it must be 1..6
    if (this.guestCount !== undefined) {
      const guestCountNumber = Number(this.guestCount);
      if (!Number.isInteger(guestCountNumber) || guestCountNumber < 1) {
        throw new Error("Guest count must be a positive integer.");
      }
      if (guestCountNumber > 6) {
        throw new Error("Guest count cannot exceed 6.");
      }

      // Ensure the sanitized DTO always holds a number
      this.guestCount = guestCountNumber;
    }

    // Basic Aadhaar sanity: 12 digits (not doing advanced validation here)
    const aadhaarString = String(this.aadhaarNumber).replace(/\s+/g, "");
    if (!/^\d{12}$/.test(aadhaarString)) {
      throw new Error("Aadhaar number must be a 12-digit number.");
    }
    this.aadhaarNumber = aadhaarString;

    return true;
  }
}
