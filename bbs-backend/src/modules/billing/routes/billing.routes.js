import { Router } from "express";
import { BillingController } from "../controller/billing.controller.js";

// Middlewares
import { validateDto } from "../../../middlewares/validate.js";
import {
  protectRoute,
  restrictTo,
} from "../../../middlewares/auth.middleware.js";
import { catchAsync } from "../../../utils/catchAsync.js";

// DTOs (Assuming we created these in the dto folder)
import { CheckoutRequestDto } from "../dto/checkout.request.dto.js";
import { CheckInRequestDto } from "../dto/checkin.request.dto.js";

const router = Router();
const billingController = new BillingController();

/**
 * ==========================================
 * OPERATIONAL API ROUTES (/api/v1/operations)
 * ==========================================
 */

// 1. GUEST CHECK-IN
// Access: Clerk or Admin Only
router.post(
  "/:bookingId/checkin",
  protectRoute,
  restrictTo("CLERK", "ADMIN"), // Strict Access Control
  validateDto(CheckInRequestDto), // Enforces Aadhaar and Max 6 Guests rules
  catchAsync(billingController.processCheckIn),
);

// 2. GUEST CHECK-OUT & SETTLEMENT
// Access: Clerk or Admin Only
router.post(
  "/:bookingId/checkout",
  protectRoute,
  restrictTo("CLERK", "ADMIN"),
  validateDto(CheckoutRequestDto), // Enforces Meter Readings presence
  catchAsync(billingController.processCheckOut),
);

export default router;
