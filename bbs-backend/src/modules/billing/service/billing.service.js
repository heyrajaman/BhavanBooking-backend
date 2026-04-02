// src/modules/billing/service/billing.service.js
import Invoice from "../model/invoice.model.js";
import PDFDocument from "pdfkit";
import { AppError } from "../../../utils/AppError.js";
import { PaymentService } from "../../payment/service/payment.service.js";
import { UserService } from "../../user/service/user.service.js";
import { BookingAccessService } from "../../booking/service/booking.access.service.js";
import { AdminService } from "../../admin/service/admin.service.js";
import minioClient from "../../../config/minio.js";
import { uploadMulterFileToMinio } from "../../../utils/minioUpload.js";
import { enqueueInvoicePdfGeneration } from "../workers/billing.queue.js";
import { InvoiceCalculatorService } from "./invoice-calculator.service.js";
import { BillingApprovalSettlementService } from "./billing-approval-settlement.service.js";

export class BillingService {
  constructor() {
    this.paymentService = new PaymentService();
    this.userService = new UserService();
    this.bookingService = new BookingAccessService();
    this.adminService = new AdminService();
    this.invoiceCalculator = new InvoiceCalculatorService();
    this.billingApprovalSettlementService =
      new BillingApprovalSettlementService({
        paymentService: this.paymentService,
      });
  }

  // Helper function to generate a unique invoice number
  _generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000); // 5 digit random number
    return `INV-${year}-${randomSuffix}`;
  }

  /**
   * MAKER: Clerk drafts the invoice.
   * Calculates deductions, taxes, and finalizes the financial snapshot.
   */
  async generateDraftInvoice(dto, clerkId) {
    // 1. Fetch the Booking AND the associated Customer User in one go
    const booking = await this.bookingService.findById(dto.bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status !== "CHECKED_IN") {
      throw new AppError(
        `Cannot generate an invoice for a booking with status: ${booking.status}. The user must be CHECKED_IN.`,
        400,
      );
    }

    const customer = await this.userService.findById(booking.userId);
    if (!customer) {
      throw new AppError(
        "Customer associated with this booking not found",
        404,
      );
    }

    const existingInvoice = await Invoice.findOne({
      where: { bookingId: dto.bookingId },
    });

    if (existingInvoice && existingInvoice.approvalStatus !== "REJECTED") {
      throw new AppError(
        "An active invoice already exists for this booking",
        400,
      );
    }

    const taxSettings = await this.adminService.getTaxSettings();
    const invoiceSnapshot =
      this.invoiceCalculator.calculateDraftInvoiceSnapshot({
        dto,
        booking,
        customer,
        taxSettings,
      });

    const {
      invoiceType,
      settlementMode,
      userId,
      customerName,
      customerEmail,
      customerPhone,
      billingAddress,
      dueDate,
      baseAmount,
      additionalItems,
      totalAdditionalAmount,
      discountAmount,
      cgstAmount,
      sgstAmount,
      totalAmount,
      electricityUnitsConsumed,
      electricityCharges,
      cleaningCharges,
      generatorCharges,
      damagesAndPenalties,
      totalDeductions,
      securityDepositHeld,
      finalRefundAmount,
      additionalBalanceDue,
    } = invoiceSnapshot;

    // --- 7. Save or Update ---
    if (existingInvoice) {
      existingInvoice.settlementMode = settlementMode;
      existingInvoice.invoiceType = invoiceType;
      existingInvoice.userId = userId;
      existingInvoice.customerName = customerName;
      existingInvoice.customerEmail = customerEmail;
      existingInvoice.customerPhone = customerPhone;

      existingInvoice.billingAddress = billingAddress;
      existingInvoice.dueDate = dueDate;

      existingInvoice.baseAmount = baseAmount;
      existingInvoice.additionalItems = additionalItems;
      existingInvoice.totalAdditionalAmount = totalAdditionalAmount;
      existingInvoice.discountAmount = discountAmount;

      existingInvoice.cgstAmount = cgstAmount;
      existingInvoice.sgstAmount = sgstAmount;
      existingInvoice.totalAmount = totalAmount;

      existingInvoice.electricityUnitsConsumed = electricityUnitsConsumed;
      existingInvoice.electricityCharges = electricityCharges;
      existingInvoice.cleaningCharges = cleaningCharges;
      existingInvoice.generatorCharges = generatorCharges;
      existingInvoice.damagesAndPenalties = damagesAndPenalties;
      existingInvoice.totalDeductions = totalDeductions;
      existingInvoice.securityDepositHeld = securityDepositHeld;
      existingInvoice.finalRefundAmount = finalRefundAmount;
      existingInvoice.additionalBalanceDue = additionalBalanceDue;

      existingInvoice.approvalStatus = "PENDING_ADMIN_APPROVAL";
      existingInvoice.generatedBy = clerkId;
      existingInvoice.adminRemarks = null;

      await existingInvoice.save();
      return existingInvoice;
    }

    const invoiceNumber = this._generateInvoiceNumber();

    const draftInvoice = await Invoice.create({
      invoiceNumber,
      invoiceType,
      settlementMode,
      bookingId: dto.bookingId,
      userId: userId,
      generatedBy: clerkId,

      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,

      billingAddress,
      dueDate: dueDate,

      baseAmount,
      additionalItems,
      totalAdditionalAmount,
      discountAmount,

      cgstAmount,
      sgstAmount,
      totalAmount,

      electricityUnitsConsumed,
      electricityCharges,
      cleaningCharges,
      generatorCharges,
      damagesAndPenalties,
      totalDeductions,
      securityDepositHeld,
      finalRefundAmount,
      additionalBalanceDue,

      approvalStatus: "PENDING_ADMIN_APPROVAL",
      paymentStatus: "PENDING",
    });

    return draftInvoice;
  }

  async getInvoiceByBookingId(bookingId) {
    const invoice = await Invoice.findOne({
      where: { bookingId },
      include: [
        {
          association: "clerk",
          attributes: ["id", "fullName"],
        },

        {
          association: "admin",
          attributes: ["id", "fullName", "signatureUrl"],
        },
      ],
    });
    if (!invoice) {
      throw new AppError("No invoice found for this booking", 404);
    }
    return invoice;
  }

  /**
   * CHECKER: Admin reviews the drafted invoice.
   */
  async processAdminApproval(invoiceId, dto, adminId) {
    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) throw new AppError("Invoice not found", 404);

    if (invoice.approvalStatus !== "PENDING_ADMIN_APPROVAL") {
      throw new AppError(`Invoice is already ${invoice.approvalStatus}`, 400);
    }

    const booking = await this.bookingService.findById(invoice.bookingId);
    if (!booking) throw new AppError("Associated booking not found", 404);

    const admin = await this.userService.findById(adminId);
    if (!admin) throw new AppError("Admin not found", 404);

    // If Admin Rejects
    if (dto.approvalStatus === "REJECTED") {
      invoice.approvalStatus = "REJECTED";
      invoice.adminRemarks = dto.adminRemarks;
      invoice.approvedBy = adminId;
      await invoice.save();

      return { message: "Invoice rejected. Sent back to clerk.", invoice };
    }

    // --- IF ADMIN APPROVES ---

    if (!admin.signatureUrl) {
      throw new AppError(
        "Signature missing. Please upload your digital signature in your profile before approving invoices.",
        400,
      );
    }

    const { approvalMessage, refundDetails } =
      await this.billingApprovalSettlementService.applySettlement(
        invoice,
        booking,
      );

    // 2. Save Invoice Status
    invoice.approvalStatus = "APPROVED";
    invoice.approvedBy = adminId;
    invoice.adminSignatureUrl = admin.signatureUrl;

    await invoice.save();

    // 3. Complete the Booking
    booking.status = "CHECKED_OUT";
    await booking.save();

    let pdfGenerationQueued = false;
    try {
      await enqueueInvoicePdfGeneration(invoice.id);
      pdfGenerationQueued = true;
    } catch (error) {
      console.error(
        `⚠️ Could not enqueue invoice PDF generation for ${invoice.id}:`,
        error.message,
      );
    }

    return {
      message: approvalMessage,
      refundId: refundDetails,
      settlementReport: invoice,
      pdfGenerationQueued,
    };
  }

  async generateAndUploadInvoicePdf(invoiceId) {
    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    if (invoice.approvalStatus !== "APPROVED") {
      throw new AppError(
        `Invoice ${invoice.invoiceNumber} is not approved yet.`,
        400,
      );
    }

    const pdfBuffer = await this._buildInvoicePdfBuffer(invoice);

    const bucketName = process.env.MINIO_BUCKET_NAME;
    const fileName = `invoices/${invoice.invoiceNumber}-${Date.now()}.pdf`;

    await minioClient.putObject(
      bucketName,
      fileName,
      pdfBuffer,
      pdfBuffer.length,
      {
        "Content-Type": "application/pdf",
      },
    );

    const minioEndpoint = process.env.MINIO_ENDPOINT;
    const pdfUrl = `${minioEndpoint}/${bucketName}/${fileName}`;

    invoice.invoicePdfUrl = pdfUrl;
    await invoice.save();

    return pdfUrl;
  }

  _buildInvoicePdfBuffer(invoice) {
    const formatMoney = (value) => Number(value || 0).toFixed(2);
    const formatDate = (value) =>
      new Date(value).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });

    const safe = (value) =>
      value === null || value === undefined ? "-" : String(value);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).text(`Invoice ${safe(invoice.invoiceNumber)}`);
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor("#4b5563")
        .text(`Date: ${formatDate(invoice.invoiceDate)}`);
      doc.text(`Due Date: ${formatDate(invoice.dueDate)}`);

      doc.moveDown(1);
      doc.fillColor("#111827").fontSize(14).text("Customer");
      doc.moveDown(0.3);
      doc.fontSize(11).text(safe(invoice.customerName));
      doc.fillColor("#4b5563").text(safe(invoice.customerEmail));
      doc.text(safe(invoice.customerPhone));
      doc.text(safe(invoice.billingAddress));

      doc.moveDown(1);
      doc.fillColor("#111827").fontSize(14).text("Charges");
      doc.moveDown(0.3);

      const writeAmountRow = (label, amount) => {
        doc.fillColor("#111827").fontSize(11).text(label, { continued: true });
        doc.text(`INR ${formatMoney(amount)}`, { align: "right" });
      };

      writeAmountRow("Base Amount", invoice.baseAmount);
      writeAmountRow("Additional Charges", invoice.totalAdditionalAmount);
      writeAmountRow("CGST", invoice.cgstAmount);
      writeAmountRow("SGST", invoice.sgstAmount);
      writeAmountRow("Discount", `-${formatMoney(invoice.discountAmount)}`);
      writeAmountRow("Deductions", invoice.totalDeductions);

      doc.moveDown(0.3);
      doc.font("Helvetica-Bold");
      writeAmountRow("Total", invoice.totalAmount);
      doc.font("Helvetica");

      doc.moveDown(1);
      doc.fillColor("#111827").fontSize(14).text("Settlement");
      doc.moveDown(0.3);
      writeAmountRow("Security Deposit Held", invoice.securityDepositHeld);
      writeAmountRow("Final Refund Amount", invoice.finalRefundAmount);
      writeAmountRow("Additional Balance Due", invoice.additionalBalanceDue);
      doc
        .fillColor("#111827")
        .fontSize(11)
        .text("Settlement Mode", { continued: true });
      doc.text(safe(invoice.settlementMode), { align: "right" });

      doc.end();
    });
  }

  /**
   * Uploads a generated Invoice PDF to MinIO and attaches the URL to the invoice.
   */
  async uploadInvoicePdf(invoiceId, file) {
    // 1. Find the invoice
    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    // Create a clean file name using the actual invoice number (e.g., invoices/INV-2026-12345-170834.pdf)
    const fileName = `invoices/${invoice.invoiceNumber}-${Date.now()}.pdf`;

    const { url: pdfUrl } = await uploadMulterFileToMinio({
      file,
      objectName: fileName,
      cleanup: true,
    });

    // 5. Update the Invoice record
    invoice.invoicePdfUrl = pdfUrl;

    await invoice.save();

    return pdfUrl;
  }

  // Add this method to your BillingService class
  async getInvoiceForCustomer(bookingId, userId) {
    const invoice = await Invoice.findOne({
      where: { bookingId },
      include: [
        {
          association: "booking",
          where: { userId }, // This ensures User A can't see User B's invoice
          attributes: ["id", "status"],
        },
        { association: "clerk", attributes: ["id", "fullName"] },
        {
          association: "admin",
          attributes: ["id", "fullName", "signatureUrl"],
        },
      ],
    });

    if (!invoice) {
      throw new AppError("Invoice not found or access denied.", 404);
    }

    return invoice;
  }
}
