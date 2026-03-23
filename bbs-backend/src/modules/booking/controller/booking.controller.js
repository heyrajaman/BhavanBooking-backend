// src/modules/booking/controller/booking.controller.js
import { BookingResponseDto } from "../dto/booking.response.dto.js";
import { BookingService } from "../service/booking.service.js";
import { uploadFileToMinio } from "../../../config/minio.js";
import Booking from "../model/booking.model.js";
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
    const { newBooking } = await this.bookingService.createBooking(
      userId,
      bookingData,
    );

    const formattedBooking = new BookingResponseDto(newBooking);

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
    // 1. Grab the FULL request body (supports both facilityId and customFacilities)
    const bookingData = req.body;

    // 2. Make sure they actually sent all the required time fields
    if (!bookingData.startTime || !bookingData.endTime) {
      return res.status(400).json({
        success: false,
        message: "startTime and endTime are required to check availability.",
      });
    }

    // 3. Validate that at least one type of booking is requested
    if (
      !bookingData.facilityId &&
      (!bookingData.customFacilities ||
        bookingData.customFacilities.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide either a facilityId or an array of customFacilities.",
      });
    }

    // 4. Pass the entire object to the service so it can process custom arrays!
    const result =
      await this.bookingService.checkAvailabilityAndPrice(bookingData);

    // 5. Send the result back to the frontend
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

  /**
   * STAFF: Marks a confirmed booking as checked-in.
   */
  checkInBooking = async (req, res, next) => {
    const { bookingId } = req.params;
    const clerkId = req.user.id;
    const { remainingAmountPaid, checkInPaymentMode } = req.body;

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        success: false,
        message: "Only confirmed bookings can be checked in.",
      });
    }

    if (booking.paymentStatus !== "COMPLETED") {
      if (
        booking.paymentStatus === "PARTIAL" &&
        checkInPaymentMode === "CASH"
      ) {
        if (!remainingAmountPaid || Number(remainingAmountPaid) <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "You must enter the remaining cash amount collected to proceed.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Guest cannot be checked in! They must pay the remaining balance online, or you must record a CASH payment.",
        });
      }
    }

    // 1. Enforce that the image was actually provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "An Aadhar image is strictly required to complete check-in.",
      });
    }

    // 2. Upload the file to MinIO
    const aadharFileName = await uploadFileToMinio(req.file);

    // 3. Pass the generated filename to the service
    const checkedInBooking = await this.bookingService.checkInBooking(
      bookingId,
      aadharFileName,
      {
        checkInPaymentMode,
        remainingAmountPaid,
        clerkId,
      },
    );

    // Format response (Assuming BookingResponseDto handles the new fields)
    const formattedBooking = new BookingResponseDto(checkedInBooking);

    return res.status(200).json({
      success: true,
      message: "Guest successfully checked in. ID securely stored.",
      data: formattedBooking,
    });
  };

  /**
   * STAFF: Marks a checked-in booking as checked-out.
   */
  checkOutBooking = async (req, res, next) => {
    const { bookingId } = req.params;
    const checkedOutBooking =
      await this.bookingService.checkOutBooking(bookingId);

    const formattedBooking = new BookingResponseDto(checkedOutBooking);

    return res.status(200).json({
      success: true,
      message: "Guest has been successfully checked out.",
      data: formattedBooking,
    });
  };

  /**
   * STAFF: Rejects a pending booking application.
   */
  rejectBooking = async (req, res, next) => {
    // 1. Grab the booking ID from the URL
    const { bookingId } = req.params;

    // 2. Call the service to update the database
    const rejectedBooking = await this.bookingService.rejectBooking(bookingId);

    // 3. Format the response using your existing DTO
    const formattedBooking = new BookingResponseDto(rejectedBooking);

    // 4. Send success response
    return res.status(200).json({
      success: true,
      message: "Booking application has been successfully rejected.",
      data: formattedBooking,
    });
  };

  /**
   * Generates a summary report of bookings within a date range
   */
  generateReport = async (req, res, next) => {
    // Pass the query parameters (fromDate, toDate) to the service
    const reportData = await this.bookingService.generateReport(req.query);

    return res.status(200).json({
      success: true,
      message: "Report generated successfully.",
      data: reportData,
    });
  };
}
