export class BookingResponseDto {
  constructor(bookingModel, facilities = []) {
    this.bookingReference = bookingModel.bookingReference;
    this.status = bookingModel.status;
    this.eventType = bookingModel.eventType;
    this.schedule = {
      checkIn: bookingModel.startDatetime,
      checkOut: bookingModel.endDatetime, // Standard 8:00 AM [cite: 77]
    };
    this.facilitiesBooked = facilities.map((f) => ({
      name: f.name,
      type: f.facilityType,
      rateApplied: f.BookingFacility
        ? f.BookingFacility.lockedRate
        : f.baseRatePerDay,
    }));
    this.rulesApplied = {
      vegetarianOnly: bookingModel.isVegetarianOnly,
      noDj: bookingModel.isDjProhibited,
    };
  }
}
