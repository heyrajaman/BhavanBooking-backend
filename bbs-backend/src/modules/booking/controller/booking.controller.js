// src/modules/booking/controller/booking.controller.js
import { BookingResponseDto } from "../dto/booking.response.dto.js";
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
    const { newBooking, facility } = await this.bookingService.createBooking(
      userId,
      bookingData,
    );

    const formattedBooking = new BookingResponseDto(newBooking, facility);

    // 4. Return success response
    return res.status(201).json({
      success: true,
      message:
        "Booking request submitted successfully. It is now pending Clerk review.",
      data: formattedBooking,
    });
  };

  /**
   * Handles the request to fetch unavailable dates for a facility's calendar.
   */
  getUnavailableDates = async (req, res, next) => {
    // 1. Grab the facility ID from the URL parameters
    const { facilityId } = req.params;

    // 2. Ask the service for the blocked dates
    const blockedDates =
      await this.bookingService.getUnavailableDates(facilityId);

    // 3. Send the data back to the frontend calendar
    return res.status(200).json({
      success: true,
      message: "Unavailable dates retrieved successfully.",
      data: blockedDates,
    });
  };

  /**
   * Handles the request to check if dates are available and returns a price quote.
   */
  checkAvailability = async (req, res, next) => {
    // 1. Grab the details sent by the frontend calendar
    const { facilityId, startTime, endTime } = req.body;

    // 2. Make sure they actually sent all the required fields
    if (!facilityId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message:
          "facilityId, startTime, and endTime are required to check availability.",
      });
    }

    // 3. Ask the service to check the dates and calculate the price
    const result = await this.bookingService.checkAvailabilityAndPrice(
      facilityId,
      startTime,
      endTime,
    );

    // 4. Send the result back to the frontend
    return res.status(200).json({
      success: true,
      data: result,
    });
  };

  /**
   * Fetches the booking history for the currently logged-in user.
   */
  getMyBookings = async (req, res, next) => {
    // 1. Grab the secure user ID injected by the `protect` middleware
    const userId = req.user.id;

    // 2. Fetch their bookings from the service
    const bookings = await this.bookingService.getMyBookings(userId);

    // 3. Map the raw database array into your clean Response DTOs
    const formattedBookings = bookings.map(
      (booking) => new BookingResponseDto(booking),
    );

    // 4. Send the clean data back to the frontend
    return res.status(200).json({
      success: true,
      message: "User booking history retrieved successfully.",
      count: formattedBookings.length,
      data: formattedBookings,
    });
  };
}
