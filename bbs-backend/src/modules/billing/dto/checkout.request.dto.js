export class CheckoutRequestDto {
  constructor(data) {
    // this.bookingId = data.bookingId;
    this.startMeterReading = data.startMeterReading;
    this.endMeterReading = data.endMeterReading;
    // Penalties is an optional array of objects: [{ reason: "Alcohol", amount: 10000 }]
    this.penalties = data.penalties || [];
    this.generatorHours = data.generatorHours || 0;
  }

  isValid() {
    // if (!this.bookingId)
    //   throw new Error("Booking ID is required for checkout.");

    if (
      this.startMeterReading === undefined ||
      this.endMeterReading === undefined
    ) {
      throw new Error(
        "Start and End meter readings are strictly required for checkout.",
      );
    }

    if (this.endMeterReading < this.startMeterReading) {
      throw new Error("End meter reading cannot be less than start reading.");
    }

    // if (!Array.isArray(this.penalties)) {
    //   throw new Error("Penalties must be an array.");
    // }

    return true;
  }
}
