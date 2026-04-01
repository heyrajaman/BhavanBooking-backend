// src/modules/booking/routes/booking.routes.js
import { Router } from "express";
import { BookingController } from "../controller/booking.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import {
  CheckInDto,
  CreateBookingDto,
  generateReportDto,
  CreateBookingOnBehalfDto,
  CancelBookingDto,
  CompleteManualRefundDto,
} from "../dto/booking.request.dto.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";
import { UuidParamDto } from "../../../shared/dto/common.dto.js";
import { uploadImage } from "../../../middlewares/upload.middleware.js";

const router = Router();
const bookingController = new BookingController();

// GET /api/v1/bookings/facility/:facilityId/unavailable-dates
// Public route for the frontend calendar to fetch blocked dates
router.get(
  "/facility/:facilityId/unavailable-dates",
  catchAsync(bookingController.getUnavailableDates),
);

// POST /api/v1/bookings/check-availability
// Public route for the frontend to verify dates and get a price quote
router.post(
  "/check-availability",
  catchAsync(bookingController.checkAvailability),
);

// GET /api/v1/bookings/my-bookings - Fetch user's own booking history
router.get(
  "/my-bookings",
  protect, // Ensure the user is logged in (this attaches req.user.id)
  catchAsync(bookingController.getMyBookings),
);

// GET /api/v1/bookings/report - Generate booking revenue report
router.get(
  "/report",
  protect, // 1. Must be logged in
  restrictTo("ADMIN", "CLERK"), // 2. Must be staff
  validateDto(generateReportDto, "query"), // 3. Validate fromDate and toDate from req.query
  catchAsync(bookingController.generateReport), // 4. Execute controller logic
);

// POST /api/v1/bookings - Submit a new booking form
router.post(
  "/",
  protect, // 1. Ensure the user is logged in
  validateDto(CreateBookingDto), // 2. Validate the incoming form payload
  catchAsync(bookingController.createBooking), // 3. Execute the controller logic
);

router.post(
  "/on-behalf",
  protect,
  restrictTo("CLERK", "ADMIN"), // Only staff can do this
  validateDto(CreateBookingOnBehalfDto),
  catchAsync(bookingController.createBookingOnBehalf),
);

router.post(
  "/:bookingId/upload-aadhaar",
  protect,
  restrictTo("USER"),
  uploadImage.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  catchAsync(bookingController.uploadAadhaarDocuments),
);

// 2. Admin/Clerk Upload Route
router.patch(
  "/admin/:bookingId/upload-aadhaar",
  protect,
  restrictTo("ADMIN", "CLERK"),
  uploadImage.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  catchAsync(bookingController.adminUploadAadhaarDocuments),
);

// GET /api/v1/bookings/cancellation-policy - Public route for the frontend to display rules
router.get(
  "/cancellation-policy",
  catchAsync(bookingController.getCancellationPolicy),
);

// PATCH /api/v1/bookings/:id/cancel - User cancels their own booking
router.patch(
  "/:bookingId/cancel",
  protect, // Ensure user is logged in
  validateDto(UuidParamDto, "params"), // Validate the booking ID from the URL
  validateDto(CancelBookingDto, "body"), // Validate the optional reason
  catchAsync(bookingController.cancelBooking),
);

router.patch(
  "/:bookingId/complete-manual-refund",
  protect,
  restrictTo("CLERK", "ADMIN"), // Only staff can confirm cash was handed over
  validateDto(UuidParamDto, "params"),
  validateDto(CompleteManualRefundDto, "body"),
  catchAsync(bookingController.completeManualRefund),
);

// PATCH /api/v1/bookings/:bookingId/check-in - Staff checks in a guest
router.patch(
  "/:bookingId/check-in",
  protect,
  restrictTo("CLERK", "ADMIN"),
  validateDto(UuidParamDto, "params"),
  validateDto(CheckInDto, "body"),
  catchAsync(bookingController.checkInBooking),
);

// PATCH /api/v1/bookings/:bookingId/check-out - Staff checks out a guest
router.patch(
  "/:bookingId/check-out",
  protect,
  restrictTo("CLERK", "ADMIN"),
  validateDto(UuidParamDto, "params"),
  catchAsync(bookingController.checkOutBooking),
);

// PATCH /api/v1/bookings/:bookingId/reject - Staff rejects a booking
router.patch(
  "/:bookingId/reject",
  protect, // 1. Must be logged in
  restrictTo("CLERK", "ADMIN"), // 2. Must be a staff member
  validateDto(UuidParamDto, "params"), // 3. Ensure valid URL ID
  catchAsync(bookingController.rejectBooking),
);

export default router;
