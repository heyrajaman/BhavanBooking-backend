// src/modules/booking/routes/booking.routes.js
import { Router } from "express";
import { BookingController } from "../controller/booking.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import { CreateBookingDto } from "../dto/booking.request.dto.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";

const router = Router();
const bookingController = new BookingController();

// POST /api/v1/bookings - Submit a new booking form
router.post(
  "/",
  protect, // 1. Ensure the user is logged in
  validateDto(CreateBookingDto), // 2. Validate the incoming form payload
  catchAsync(bookingController.createBooking), // 3. Execute the controller logic
);

// PATCH /api/v1/bookings/:id/verify-availability
// Only Clerks can perform this action
router.patch(
  "/:id/verify-availability",
  protect,
  restrictTo("CLERK"), // Blocks standard users and admins from doing the clerk's job
  catchAsync(bookingController.verifyByClerk),
);

router.patch(
  "/:id/approve",
  protect,
  restrictTo("ADMIN"), // Blocks standard users and Clerks
  catchAsync(bookingController.approveByAdmin),
);

export default router;
