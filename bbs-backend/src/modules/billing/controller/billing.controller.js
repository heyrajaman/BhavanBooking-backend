// src/modules/billing/controller/billing.controller.js
import { BillingService } from "../service/billing.service.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { AppError } from "../../../utils/AppError.js";

const billingService = new BillingService();

export const generateDraftInvoice = catchAsync(async (req, res) => {
  // req.user.id is extracted from your authentication middleware
  const clerkId = req.user.id;

  // Pass the DTO-validated body and the clerk's ID to the service
  const invoice = await billingService.generateDraftInvoice(req.body, clerkId);

  res.status(201).json({
    status: "success",
    message: "Invoice generated successfully",
    data: {
      invoice,
    },
  });
});

export const getInvoice = catchAsync(async (req, res) => {
  const { bookingId } = req.params;

  // Fetch the fully populated invoice
  const invoice = await billingService.getInvoiceByBookingId(bookingId);

  res.status(200).json({
    status: "success",
    data: {
      invoice,
    },
  });
});

export const processAdminApproval = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;
  const adminId = req.user.id;

  // Process the approval/rejection and potential refunds
  const result = await billingService.processAdminApproval(
    invoiceId,
    req.body,
    adminId,
  );

  res.status(200).json({
    status: "success",
    message: result.message,
    data: {
      refundId: result.refundId,
      settlementReport: result.settlementReport,
    },
  });
});

export const uploadInvoicePdf = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError("Please upload a valid PDF document.", 400);
  }

  const { invoiceId } = req.params;

  const pdfUrl = await billingService.uploadInvoicePdf(invoiceId, req.file);

  res.status(200).json({
    status: "success",
    message: "Invoice PDF uploaded and saved successfully.",
    data: {
      invoicePdfUrl: pdfUrl,
    },
  });
});
