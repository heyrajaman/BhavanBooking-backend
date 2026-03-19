// src/modules/billing/routes/billing.routes.js
import { Router } from "express";

// Import the individual controller functions directly
import {
  generateDraftInvoice,
  getInvoice,
  processAdminApproval,
  uploadInvoicePdf,
  getInvoiceForCustomer,
} from "../controller/billing.controller.js";

// Middlewares
import { validateDto } from "../../../middlewares/validate.js";
import {
  protectRoute,
  restrictTo,
} from "../../../middlewares/auth.middleware.js";

// Import the exact DTOs we created in Step 2
import {
  generateInvoiceDto,
  updateInvoiceStatusDto,
} from "../dto/invoice.dto.js";

// Assuming you still have this for checking URL params
import { uploadPdf } from "../../../middlewares/upload.middleware.js";

const router = Router();

/**
 * ==========================================
 * BILLING API ROUTES (/api/v1/billing)
 * ==========================================
 */

// 1. MAKER: Generate Draft Invoice (Clerks & Admins)
// Changed route from "/:bookingId/draft-invoice" to "/draft-invoice"
// because bookingId is now strictly validated in the req.body via generateInvoiceDto
router.post(
  "/draft-invoice",
  protectRoute,
  restrictTo("CLERK", "ADMIN"),
  validateDto(generateInvoiceDto), // Validates req.body
  generateDraftInvoice, // Already wrapped in catchAsync in the controller
);

// GET: Fetch invoice by Booking ID
router.get(
  "/:bookingId/invoice",
  protectRoute,
  restrictTo("CLERK", "ADMIN"),
  // You might need to ensure UuidParamDto looks for 'bookingId' if it was generically written
  getInvoice,
);

// Customer-facing route
router.get(
  "/my-invoice/:bookingId",
  protectRoute,
  restrictTo("USER"),
  getInvoiceForCustomer,
);

// 2. CHECKER: Approve or Reject Invoice (Strictly Admins)
router.patch(
  "/invoice/:invoiceId/approve",
  protectRoute,
  restrictTo("ADMIN"), // ONLY Admins can approve
  validateDto(updateInvoiceStatusDto), // Validates req.body (status and remarks)
  processAdminApproval,
);

router.patch(
  "/:invoiceId/upload-pdf",
  protectRoute,
  restrictTo("ADMIN", "CLERK"),
  uploadPdf.single("invoicePdf"),
  uploadInvoicePdf,
);

export default router;
