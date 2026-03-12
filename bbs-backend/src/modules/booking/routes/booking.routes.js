// src/modules/booking/routes/booking.routes.js
import { Router } from "express";
import { BookingController } from "../controller/booking.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import { CreateBookingDto } from "../dto/booking.request.dto.js";
import { protect } from "../../../middlewares/auth.middleware.js";
import { catchAsync } from "../../../utils/catchAsync.js";

const router = Router();
const bookingController = new BookingController();

// POST /api/v1/bookings - Submit a new booking form
router.post(
  "/",
  protect, // 1. Ensure the user is logged in
  validateDto(CreateBookingDto), // 2. Validate the incoming form payload
  catchAsync(bookingController.createBooking), // 3. Execute the controller logic
);

export default router;
