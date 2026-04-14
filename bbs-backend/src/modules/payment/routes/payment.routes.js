// src/modules/payment/routes/payment.routes.js
import { Router } from "express";
import { PaymentController } from "../controller/payment.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";
import {
  OfflineAdvanceDto,
  OfflineRemainingDto,
  CreateInitialOrderDto,
  VerifyPaymentDto,
} from "../dto/payment.dto.js";
import { validateDto } from "../../../middlewares/validate.js";
import { paymentOrderLimiter } from "../../../middlewares/rateLimit.middleware.js";

const router = Router();
const paymentController = new PaymentController();

router.post(
  "/advance/offline",
  protect,
  restrictTo("CLERK", "ADMIN"), // Staff only
  validateDto(OfflineAdvanceDto),
  catchAsync(paymentController.verifyOfflineAdvance),
);

router.post(
  "/offline-remaining",
  protect,
  restrictTo("CLERK", "ADMIN"),
  validateDto(OfflineRemainingDto),
  catchAsync(paymentController.verifyOfflineRemaining),
);

// All payment routes require the user to be logged in and have the "USER" role
router.use(protect, restrictTo("USER"));

// --- INITIAL PAYMENT ROUTES (Replaces Advance) ---

// 1. Create Razorpay order for the Initial Amount (HOLD or FULL)
router.post(
  "/initial/create-order",
  paymentOrderLimiter,
  validateDto(CreateInitialOrderDto),
  catchAsync(paymentController.createInitialOrder),
);

// 2. Verify the Initial Payment
router.post(
  "/initial/verify",
  validateDto(VerifyPaymentDto),
  catchAsync(paymentController.verifyInitialPayment),
);

// 3. Create Razorpay order for the Remaining Amount
router.post(
  "/remaining/create-order",
  paymentOrderLimiter,
  catchAsync(paymentController.createRemainingOrder),
);

// 4. Verify the Remaining Payment
router.post("/remaining/verify", catchAsync(paymentController.verifyRemaining));

export default router;
