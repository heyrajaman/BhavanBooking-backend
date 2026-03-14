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

    if (bookingModel.user) {
      this.user = {
        id: bookingModel.user.id,
        fullName: bookingModel.user.fullName,
        email: bookingModel.user.email,
        phone: bookingModel.user.mobile,
      };
    }

    const facility = facilityModel || bookingModel.facility;

    if (facility) {
      this.facility = {
        id: facility.id,
        name: facility.name,
        description: facility.description,
        facilityType: facility.facilityType,
      };
    }
  }
}

export class BookingDetailResponseDto {
  constructor(booking) {
    this.id = booking.id;
    this.status = booking.status;
    this.eventType = booking.eventType;
    this.guestCount = booking.guestCount;

    this.schedule = {
      startTime: booking.startTime,
      endTime: booking.endTime,
    };

    this.financials = {
      calculatedAmount: booking.calculatedAmount,
      securityDeposit: booking.securityDeposit,
      advanceRequested: booking.advanceAmountRequested,
      paymentStatus: booking.paymentStatus,
    };

    // Safely mapping the joined User data
    this.user = booking.user
      ? {
          id: booking.user.id,
          fullName: booking.user.fullName, // Using your exact model property!
          email: booking.user.email,
          phone: booking.user.mobile,
          role: booking.user.role,
        }
      : null;

    // Safely mapping the joined Facility data
    this.facility = booking.facility
      ? {
          id: booking.facility.id,
          name: booking.facility.name,
          description: booking.facility.description,
          facilityType: booking.facility.facilityType,
          capacity: booking.facility.capacity,
          pricingType: booking.facility.pricingType,
        }
      : null;
  }
}
