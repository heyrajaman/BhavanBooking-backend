// src/modules/billing/routes/billing.routes.js
import { Router } from "express";
import { BillingController } from "../controller/billing.controller.js";

// Middlewares
import { validateDto } from "../../../middlewares/validate.js";
import {
  protectRoute,
  restrictTo,
} from "../../../middlewares/auth.middleware.js";
import { catchAsync } from "../../../utils/catchAsync.js";

// DTOs
import { GenerateInvoiceDto, ApproveInvoiceDto } from "../dto/invoice.dto.js";
import { UuidParamDto } from "../../../middlewares/common.dto.js";
// (Assuming you still have CheckInRequestDto for the check-in route)
// import { CheckInRequestDto } from "../dto/checkin.request.dto.js";

const router = Router();
const billingController = new BillingController();
/**
 * ==========================================
 * BILLING API ROUTES (/api/v1/billing)
 * ==========================================
 */
// 1. MAKER: Generate Draft Invoice (Clerks & Admins)
router.post(
  "/:bookingId/draft-invoice",
  protectRoute,
  restrictTo("CLERK", "ADMIN"), // Clerks can draft it
  validateDto(GenerateInvoiceDto),
  catchAsync(billingController.generateDraftInvoice),
);

// GET: Fetch invoice by Booking ID
router.get(
  "/:bookingId/invoice",
  protectRoute,
  restrictTo("CLERK", "ADMIN"),
  validateDto(UuidParamDto, "params"), // Uses the Uuid param validator we made
  catchAsync(billingController.getInvoice),
);

// 2. CHECKER: Approve or Reject Invoice (Strictly Admins)
router.patch(
  "/invoice/:invoiceId/approve",
  protectRoute,
  restrictTo("ADMIN"), // ONLY Admins can approve
  validateDto(ApproveInvoiceDto),
  catchAsync(billingController.processAdminApproval),
);

export default router;
