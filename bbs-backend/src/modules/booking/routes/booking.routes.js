// src/modules/booking/routes/booking.routes.js
import { Router } from "express";
import { BookingController } from "../controller/booking.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import { CreateBookingDto } from "../dto/booking.request.dto.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";
import { UuidParamDto } from "../../../middlewares/common.dto.js";

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

// POST /api/v1/bookings - Submit a new booking form
router.post(
  "/",
  protect, // 1. Ensure the user is logged in
  validateDto(CreateBookingDto), // 2. Validate the incoming form payload
  catchAsync(bookingController.createBooking), // 3. Execute the controller logic
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
