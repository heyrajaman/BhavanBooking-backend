// src/modules/booking/controller/booking.controller.js
import { BookingService } from "../service/booking.service.js";

export class BookingController {
  constructor() {
    this.bookingService = new BookingService();
  }

  createBooking = async (req, res, next) => {
    // 1. req.user is securely injected by your `protect` auth middleware
    const userId = req.user.id;

    // 2. req.body is fully validated and structured by your `CreateBookingDto`
    const bookingData = req.body;

    // 3. Pass to the service for pricing calculation and database insertion
    const newBooking = await this.bookingService.createBooking(
      userId,
      bookingData,
    );

    // 4. Return success response
    return res.status(201).json({
      success: true,
      message:
        "Booking request submitted successfully. It is now pending Clerk review.",
      data: newBooking,
    });
  };
}
