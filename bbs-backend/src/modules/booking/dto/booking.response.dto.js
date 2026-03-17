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
      actualCheckInTime: bookingModel.actualCheckInTime || null,
      actualCheckOutTime: bookingModel.actualCheckOutTime || null,
    };

    this.financials = {
      calculatedAmount: bookingModel.calculatedAmount,
      securityDeposit: bookingModel.securityDeposit,
      advanceAmountRequested: bookingModel.advanceAmountRequested,
      paymentStatus: bookingModel.paymentStatus,
    };

    this.verification = {
      aadharImageUrl: bookingModel.aadharImageUrl || null,
    };

    if (bookingModel.user) {
      this.user = {
        id: bookingModel.user.id,
        fullName: bookingModel.user.fullName,
        email: bookingModel.user.email,
        phone: bookingModel.user.mobile,
      };
    }

    // 1. ADD CUSTOM DETAILS
    this.customDetails = bookingModel.customDetails || null;

    const facility = facilityModel || bookingModel.facility;

    // 2. DYNAMIC FACILITY MAPPING
    if (facility) {
      this.facility = {
        id: facility.id,
        name: facility.name,
        description: facility.description,
        facilityType: facility.facilityType,
      };
    } else if (this.customDetails && this.customDetails.length > 0) {
      // Create a virtual facility object for custom bookings so the frontend doesn't break
      const itemNames = this.customDetails
        .map((item) => `${item.name} (x${item.quantity})`)
        .join(", ");
      this.facility = {
        id: null,
        name: `Custom Selection: ${itemNames}`,
        description: "Customized booking arrangement.",
        facilityType: "CUSTOM",
      };
    } else {
      this.facility = null;
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
      actualCheckInTime: booking.actualCheckInTime || null,
      actualCheckOutTime: booking.actualCheckOutTime || null,
    };

    this.financials = {
      calculatedAmount: booking.calculatedAmount,
      securityDeposit: booking.securityDeposit,
      advanceRequested: booking.advanceAmountRequested,
      paymentStatus: booking.paymentStatus,
    };

    this.verification = {
      aadharImageUrl: booking.aadharImageUrl || null,
    };

    // 1. ADD CUSTOM DETAILS
    this.customDetails = booking.customDetails || null;

    // Safely mapping the joined User data
    this.user = booking.user
      ? {
          id: booking.user.id,
          fullName: booking.user.fullName,
          email: booking.user.email,
          phone: booking.user.mobile,
          role: booking.user.role,
        }
      : null;

    // 2. DYNAMIC FACILITY MAPPING FOR DETAIL VIEW
    if (booking.facility) {
      this.facility = {
        id: booking.facility.id,
        name: booking.facility.name,
        description: booking.facility.description,
        facilityType: booking.facility.facilityType,
        capacity: booking.facility.capacity,
        pricingType: booking.facility.pricingType,
      };
    } else if (this.customDetails && this.customDetails.length > 0) {
      // Create a virtual facility object for custom bookings
      const itemNames = this.customDetails
        .map((item) => `${item.name} (x${item.quantity})`)
        .join(", ");
      this.facility = {
        id: null,
        name: `Custom Selection: ${itemNames}`,
        description: "Customized booking of individual facilities.",
        facilityType: "CUSTOM",
        capacity: null,
        pricingType: "MIXED",
      };
    } else {
      this.facility = null;
    }
  }
}
