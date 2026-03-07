import { Router } from "express";
import { BookingController } from "../controller/booking.controller.js";

// Middlewares
import { validateDto } from "../../../middlewares/validate.js";
import {
  protectRoute,
  restrictTo,
} from "../../../middlewares/auth.middleware.js";

// DTOs
import { CreateBookingRequestDto } from "../dto/booking.request.dto.js";

// Utilities
import { catchAsync } from "../../../utils/catchAsync.js";

const router = Router();
const bookingController = new BookingController();

/**
 * ==========================================
 * BOOKING API ROUTES (/api/v1/bookings)
 * ==========================================
 */

// 1. CREATE BOOKING APPLICATION
// Access: Logged-in Users (Admin, Clerk, Guest)
router.post(
  "/",
  protectRoute,
  validateDto(CreateBookingRequestDto),
  catchAsync(bookingController.createBooking), // No more try/catch needed inside the controller!
);

// 2. CANCEL BOOKING
// Access: ONLY System Administrator [cite: 41, 42, 43, 44]
router.post(
  "/:id/cancel",
  protectRoute,
  restrictTo("ADMIN"),
  catchAsync(bookingController.cancelBooking),
);

export default router;
