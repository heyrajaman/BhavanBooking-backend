// src/modules/payment/routes/payment.routes.js
import { Router } from "express";
import { PaymentController } from "../controller/payment.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";
import { OfflineAdvanceDto, OfflineRemainingDto } from "../dto/payment.dto.js";
import { validateDto } from "../../../middlewares/validate.js";

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
  restrictTo("STAFF", "ADMIN"),
  validateDto(OfflineRemainingDto),
  paymentController.verifyOfflineRemaining,
);

// All payment routes require the user to be logged in and have the "USER" role
router.use(protect, restrictTo("USER"));

// --- ADVANCE PAYMENT ROUTES ---

// 1. Create Razorpay order for the Advance Amount
router.post(
  "/advance/create-order",
  catchAsync(paymentController.createAdvanceOrder),
);

// 2. Verify the Advance Payment
router.post("/advance/verify", catchAsync(paymentController.verifyAdvance));

// 3. Create Razorpay order for the Remaining Amount
router.post(
  "/remaining/create-order",
  catchAsync(paymentController.createRemainingOrder),
);

// 4. Verify the Remaining Payment
router.post("/remaining/verify", catchAsync(paymentController.verifyRemaining));

export default router;
