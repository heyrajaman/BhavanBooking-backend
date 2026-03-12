// src/modules/booking/dto/booking.response.dto.js
export class BookingResponseDto {
  constructor(bookingModel, facilityModel = null) {
    this.id = bookingModel.id;
    this.status = bookingModel.status;
    this.eventType = bookingModel.eventType;
    this.guestCount = bookingModel.guestCount;

    this.schedule = {
      startTime: bookingModel.startTime,
      endTime: bookingModel.endTime,
    };

    this.financials = {
      calculatedAmount: bookingModel.calculatedAmount,
      securityDeposit: bookingModel.securityDeposit,
      advanceAmountRequested: bookingModel.advanceAmountRequested,
      paymentStatus: bookingModel.paymentStatus,
    };

    if (facilityModel) {
      this.facility = {
        id: facilityModel.id,
        name: facilityModel.name,
        facilityType: facilityModel.facilityType,
      };
    }
  }
}
