// src/modules/booking/controller/booking.controller.js
import { getIO } from "../../../config/socket.js";
import { BookingResponseDto } from "../dto/booking.response.dto.js";
import { BookingService } from "../service/booking.service.js";
import { uploadFileToMinio } from "../../../config/minio.js";
import Booking from "../model/booking.model.js";
import { AppError } from "../../../utils/AppError.js";
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

    try {
      const io = getIO();
      // Emits only to clients who joined the "admin-notifications" room
      io.to("admin-notifications").emit("new_booking_request", {
        message: "A new online booking request was submitted.",
        bookingId: formattedBooking.id,
        status: formattedBooking.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Admin Notification):", err.message);
    }

    // 4. Return success response
    return res.status(201).json({
      success: true,
      message:
        "Booking request submitted successfully. It is now pending Clerk review.",
      data: formattedBooking,
    });
  };

  uploadAadhaarDocuments = async (req, res, next) => {
    const userId = req.user.id;
    const { bookingId } = req.params;

    // Check if Multer successfully parsed the files
    if (
      !req.files ||
      !Array.isArray(req.files.frontImage) ||
      !Array.isArray(req.files.backImage) ||
      req.files.frontImage.length === 0 ||
      req.files.backImage.length === 0
    ) {
      throw new AppError(
        "Both Aadhaar front and back images are required.",
        400,
      );
    }

    const frontFile = req.files.frontImage[0];
    const backFile = req.files.backImage[0];

    // Call the service (isAdmin = false)
    const result = await this.bookingService.uploadAadhaarImages(
      bookingId,
      userId,
      frontFile,
      backFile,
      false,
    );

    return res.status(200).json({
      success: true,
      message: "Aadhaar documents uploaded and compressed successfully.",
      data: result,
    });
  };

  /**
   * STAFF: Uploads Aadhaar photos on behalf of a user
   */
  adminUploadAadhaarDocuments = async (req, res, next) => {
    const adminId = req.user.id; // Just for logging if needed
    const { bookingId } = req.params;

    if (
      !req.files ||
      !Array.isArray(req.files.frontImage) ||
      !Array.isArray(req.files.backImage) ||
      req.files.frontImage.length === 0 ||
      req.files.backImage.length === 0
    ) {
      throw new AppError(
        "Both Aadhaar front and back images are required.",
        400,
      );
    }

    const frontFile = req.files.frontImage[0];
    const backFile = req.files.backImage[0];

    // Call the service (isAdmin = true, so it bypasses the userId ownership check)
    const result = await this.bookingService.uploadAadhaarImages(
      bookingId,
      null,
      frontFile,
      backFile,
      true,
    );

    return res.status(200).json({
      success: true,
      message: "Aadhaar documents updated by staff successfully.",
      data: result,
    });
  };

  /**
   * STAFF: Creates a booking on behalf of a walk-in customer.
   */
  createBookingOnBehalf = async (req, res, next) => {
    // 1. Grab the clerk's ID for audit purposes
    const clerkId = req.user.id;

    // 2. Grab the combined user & booking payload
    const bookingData = req.body;

    // 3. Pass to the service to handle user creation and booking generation
    const { newBooking, user, isNewUser } =
      await this.bookingService.createBookingOnBehalf(bookingData, clerkId);

    // 4. Format the response
    const formattedBooking = new BookingResponseDto(newBooking);

    try {
      const io = getIO();
      io.to("admin-notifications").emit("new_walkin_booking", {
        message: `A new walk-in booking was created for ${user.fullName}.`,
        bookingId: formattedBooking.id,
        status: formattedBooking.status,
        clerkId: clerkId,
      });
    } catch (err) {
      console.error("Socket emit failed (Walk-in Notification):", err.message);
    }

    return res.status(201).json({
      success: true,
      message: `Booking created successfully for ${user.fullName}. It is now PENDING_ADMIN_APPROVAL.`,
      isNewUser: isNewUser,
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
    const checkInData = req.body;

    const checkedInBooking = await this.bookingService.checkInBooking(
      bookingId,
      checkInData,
    );

    const formattedBooking = new BookingResponseDto(checkedInBooking);

    try {
      const io = getIO();
      io.to("admin-notifications").emit("booking_status_updated", {
        message: `Booking #${formattedBooking.id} has been CHECKED IN.`,
        bookingId: formattedBooking.id,
        status: formattedBooking.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Check-In):", err.message);
    }

    return res.status(200).json({
      success: true,
      message: "Guest successfully checked in.",
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

    try {
      const io = getIO();
      io.to("admin-notifications").emit("booking_status_updated", {
        message: `Booking #${formattedBooking.id} has been CHECKED OUT.`,
        bookingId: formattedBooking.id,
        status: formattedBooking.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Check-Out):", err.message);
    }

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

    try {
      const io = getIO();
      io.to("admin-notifications").emit("booking_status_updated", {
        message: `Booking #${formattedBooking.id} was REJECTED.`,
        bookingId: formattedBooking.id,
        status: formattedBooking.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Reject):", err.message);
    }

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

  getCancellationPolicy = async (req, res) => {
    const policy = await this.bookingService.getCancellationPolicy();

    res.status(200).json({
      success: true,
      data: policy,
    });
  };

  cancelBooking = async (req, res) => {
    // 1. Extract data
    const bookingId = req.params.bookingId;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { cancellationReason } = req.body;

    // 2. Call the service layer
    const result = await this.bookingService.requestCancellation(
      bookingId,
      userId,
      userRole,
      cancellationReason,
    );

    try {
      const io = getIO();
      io.to("admin-notifications").emit("cancellation_requested", {
        message: `Booking #${result.bookingId} requested cancellation. Approval required.`,
        bookingId: result.bookingId,
        status: result.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Cancel):", err.message);
    }

    // 3. Send response
    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: result,
    });
  };

  approveCancellation = async (req, res) => {
    const bookingId = req.params.bookingId;
    const adminId = req.user.id;

    // Call the new approval and refund service
    const result = await this.bookingService.approveCancellationAndRefund(
      bookingId,
      adminId,
    );

    try {
      const io = getIO();
      io.to("admin-notifications").emit("booking_status_updated", {
        message: `Cancellation for Booking #${result.bookingId} was APPROVED.`,
        bookingId: result.bookingId,
        status: result.status,
      });
    } catch (err) {
      console.error("Socket emit failed (Approve Cancel):", err.message);
    }

    res.status(200).json({
      success: true,
      message: "Cancellation approved and refund processed successfully.",
      data: result,
    });
  };

  completeManualRefund = async (req, res) => {
    const bookingId = req.params.bookingId;
    const staffId = req.user.id;
    const { refundNote } = req.body;

    const result = await this.bookingService.completeManualRefund(
      bookingId,
      staffId,
      refundNote,
    );

    res.status(200).json({
      success: true,
      message: "Refund status updated to completed.",
      data: result,
    });
  };
}
