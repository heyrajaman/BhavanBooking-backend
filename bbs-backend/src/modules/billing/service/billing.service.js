// src/modules/billing/service/billing.service.js
import Invoice from "../model/invoice.model.js";
import Booking from "../../booking/model/booking.model.js";
import { AppError } from "../../../utils/AppError.js";
import { PaymentService } from "../../payment/service/payment.service.js";
import User from "../../user/model/user.model.js";
import minioClient from "../../../config/minio.js";

export class BillingService {
  constructor() {
    this.paymentService = new PaymentService();
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
    const booking = await Booking.findByPk(dto.bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status !== "CHECKED_IN") {
      throw new AppError(
        `Cannot generate an invoice for a booking with status: ${booking.status}. The user must be CHECKED_IN.`,
        400,
      );
    }

    const customer = await User.findByPk(booking.userId);
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

    // 2. Extract Trusted Data straight from the DB
    const securityDeposit = parseFloat(booking.securityDeposit || 0);
    const baseAmount = parseFloat(booking.calculatedAmount || 0);
    const userId = customer.id;
    // Note: Adjust 'fullName', 'email', 'phone' below if your User model uses slightly different column names (like firstName)
    const customerName = customer.fullName;
    const customerEmail = customer.email;
    const customerPhone = customer.mobile;

    // --- 3. Base Pricing & Additional Items ---
    const discountAmount = parseFloat(dto.discountAmount || 0);
    const additionalItems = dto.additionalItems || [];

    const totalAdditionalAmount = additionalItems.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0,
    );

    // --- 4. Auto-Calculate Taxes ---
    const taxableAmount = Math.max(
      0,
      baseAmount + totalAdditionalAmount - discountAmount,
    );
    const cgstAmount = parseFloat((taxableAmount * 0.025).toFixed(2));
    const sgstAmount = parseFloat((taxableAmount * 0.025).toFixed(2));
    const totalAmount = taxableAmount + cgstAmount + sgstAmount;

    // --- 5. Post-Event Deduction Calculations ---
    const electricityCharges = (dto.electricityUnitsConsumed || 0) * 14;
    const cleaningCharges = parseFloat(dto.cleaningCharges || 0);
    const generatorCharges = parseFloat(dto.generatorCharges || 0);

    let totalPenalties = 0;
    if (dto.damagesAndPenalties && dto.damagesAndPenalties.length > 0) {
      totalPenalties = dto.damagesAndPenalties.reduce(
        (sum, item) => sum + parseFloat(item.amount),
        0,
      );
    }

    const totalDeductions =
      electricityCharges + cleaningCharges + generatorCharges + totalPenalties;

    // --- 6. Final Refund / Balance Math ---
    let finalRefundAmount = securityDeposit - totalDeductions;
    let additionalBalanceDue = 0;

    if (finalRefundAmount < 0) {
      additionalBalanceDue = Math.abs(finalRefundAmount);
      finalRefundAmount = 0;
    }

    // --- 7. Save or Update ---
    if (existingInvoice) {
      // Use the trusted DB values instead of DTO
      existingInvoice.userId = userId;
      existingInvoice.customerName = customerName;
      existingInvoice.customerEmail = customerEmail;
      existingInvoice.customerPhone = customerPhone;

      existingInvoice.billingAddress = dto.billingAddress;
      existingInvoice.dueDate = dto.dueDate;

      existingInvoice.baseAmount = baseAmount;
      existingInvoice.additionalItems = additionalItems;
      existingInvoice.totalAdditionalAmount = totalAdditionalAmount;
      existingInvoice.discountAmount = discountAmount;

      existingInvoice.cgstAmount = cgstAmount;
      existingInvoice.sgstAmount = sgstAmount;
      existingInvoice.totalAmount = totalAmount;

      existingInvoice.electricityUnitsConsumed = dto.electricityUnitsConsumed;
      existingInvoice.electricityCharges = electricityCharges;
      existingInvoice.cleaningCharges = cleaningCharges;
      existingInvoice.generatorCharges = generatorCharges;
      existingInvoice.damagesAndPenalties = dto.damagesAndPenalties;
      existingInvoice.totalDeductions = totalDeductions;
      existingInvoice.securityDepositHeld = securityDeposit;
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
      bookingId: dto.bookingId,
      userId: userId, // 👈 DB value
      generatedBy: clerkId,

      customerName: customerName, // 👈 DB value
      customerEmail: customerEmail, // 👈 DB value
      customerPhone: customerPhone, // 👈 DB value

      billingAddress: dto.billingAddress,
      dueDate: dto.dueDate,

      baseAmount,
      additionalItems,
      totalAdditionalAmount,
      discountAmount,

      cgstAmount,
      sgstAmount,
      totalAmount,

      electricityUnitsConsumed: dto.electricityUnitsConsumed,
      electricityCharges,
      cleaningCharges,
      generatorCharges,
      damagesAndPenalties: dto.damagesAndPenalties,
      totalDeductions,
      securityDepositHeld: securityDeposit, // 👈 DB value
      finalRefundAmount,
      additionalBalanceDue,

      approvalStatus: "PENDING_ADMIN_APPROVAL",
      paymentStatus: "PENDING",
    });

    return draftInvoice;
  }

  async getInvoiceByBookingId(bookingId) {
    const invoice = await Invoice.findOne({ where: { bookingId } });
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

    const booking = await Booking.findByPk(invoice.bookingId);
    if (!booking) throw new AppError("Associated booking not found", 404);

    const admin = await User.findByPk(adminId);
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

    // 1. Process Refund if applicable
    let refundDetails = null;
    let approvalMessage = "Approved successfully."; // Base message

    if (invoice.finalRefundAmount > 0) {
      if (!booking.razorpayPaymentId) {
        invoice.adminRemarks =
          "Approved successfully. Manual refund required (No Payment ID found).";
      } else {
        try {
          // Trigger the Razorpay Refund via PaymentService
          const refundResponse = await this.paymentService.processRefund(
            booking.razorpayPaymentId,
            invoice.finalRefundAmount,
          );
          refundDetails = refundResponse.id;
          approvalMessage += ` Automatic refund initiated (Refund ID: ${refundDetails}).`;
          invoice.adminRemarks = approvalMessage;
        } catch (error) {
          console.warn(
            "⚠️ Auto-refund failed, switching to manual mode:",
            error.message,
          );
          approvalMessage +=
            " ⚠️ Auto-refund failed. MARKED FOR MANUAL REFUND.";
          invoice.adminRemarks = `Manual refund of ₹${invoice.finalRefundAmount} required. (Reason: API Error/Mock ID)`;
        }
      }
    } else {
      invoice.adminRemarks = "Approved successfully. No refund due.";
    }

    // 2. Save Invoice Status
    invoice.approvalStatus = "APPROVED";
    invoice.approvedBy = adminId;
    invoice.adminSignatureUrl = admin.signatureUrl;

    // If no additional balance is due, we can mark payment as finalized/paid based on your business logic
    if (invoice.additionalBalanceDue === 0 && invoice.totalAmount > 0) {
      invoice.paymentStatus = "PAID";
    }

    if (!invoice.adminRemarks) invoice.adminRemarks = approvalMessage;
    await invoice.save();

    // 3. Complete the Booking
    booking.status = "CHECKED_OUT";
    await booking.save();

    return {
      message: approvalMessage,
      refundId: refundDetails,
      settlementReport: invoice,
    };
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

    // 2. Prepare MinIO Upload Details
    const bucketName = process.env.MINIO_BUCKET_NAME;

    // Create a clean file name using the actual invoice number (e.g., invoices/INV-2026-12345-170834.pdf)
    const fileName = `invoices/${invoice.invoiceNumber}-${Date.now()}.pdf`;

    // 3. Push the memory buffer to MinIO
    await minioClient.putObject(
      bucketName,
      fileName,
      file.buffer, // The PDF data in RAM
      file.size,
      { "Content-Type": file.mimetype },
    );

    // 4. Construct the URL to save in the database
    const minioEndpoint = process.env.MINIO_ENDPOINT;
    const pdfUrl = `${minioEndpoint}/${bucketName}/${fileName}`;

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
          model: Booking,
          where: { userId }, // This ensures User A can't see User B's invoice
          attributes: ["id", "status"],
        },
      ],
    });

    if (!invoice) {
      throw new AppError("Invoice not found or access denied.", 404);
    }

    return invoice;
  }
}
