// src/modules/billing/service/billing.service.js
import Invoice from "../model/invoice.model.js";
import Booking from "../../booking/model/booking.model.js";
import { AppError } from "../../../utils/AppError.js";
import { PaymentService } from "../../payment/service/payment.service.js";

export class BillingService {
  constructor() {
    this.paymentService = new PaymentService();
  }
  /**
   * MAKER: Clerk drafts the invoice.
   * Calculates deductions but does NOT finalize the checkout.
   */
  async generateDraftInvoice(dto, clerkId) {
    // 1. Fetch the booking to get the Security Deposit
    const booking = await Booking.findByPk(dto.bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Ensure an invoice hasn't already been drafted or approved
    const existingInvoice = await Invoice.findOne({
      where: { bookingId: dto.bookingId },
    });
    if (existingInvoice && existingInvoice.approvalStatus !== "REJECTED") {
      throw new AppError(
        "An active invoice already exists for this booking",
        400,
      );
    }

    const securityDeposit = parseFloat(booking.securityDeposit || 0);

    // 2. Business Rules Calculations (Your FRS logic)
    const electricityCharges = dto.electricityUnitsConsumed * 14; // ₹14 per unit
    const cleaningCharges = dto.cleaningCharges;
    const generatorCharges = dto.generatorCharges;

    // Tally up Penalties
    let totalPenalties = 0;
    if (dto.damagesAndPenalties && dto.damagesAndPenalties.length > 0) {
      totalPenalties = dto.damagesAndPenalties.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
    }

    // Total Deductions
    const totalDeductions =
      electricityCharges + cleaningCharges + generatorCharges + totalPenalties;

    // 3. Calculate Final Refund / Balance Due
    let finalRefundAmount = securityDeposit - totalDeductions;
    let additionalBalanceDue = 0;

    if (finalRefundAmount < 0) {
      additionalBalanceDue = Math.abs(finalRefundAmount);
      finalRefundAmount = 0;
    }

    if (existingInvoice) {
      existingInvoice.electricityUnitsConsumed = dto.electricityUnitsConsumed;
      existingInvoice.electricityCharges = electricityCharges;
      existingInvoice.cleaningCharges = cleaningCharges;
      existingInvoice.generatorCharges = generatorCharges;
      existingInvoice.damagesAndPenalties = dto.damagesAndPenalties;
      existingInvoice.totalDeductions = totalDeductions;
      existingInvoice.securityDepositHeld = securityDeposit;
      existingInvoice.finalRefundAmount = finalRefundAmount;
      existingInvoice.additionalBalanceDue = additionalBalanceDue;

      // Reset the status back to pending and clear the old rejection note!
      existingInvoice.approvalStatus = "PENDING_ADMIN_APPROVAL";
      existingInvoice.generatedBy = clerkId;
      existingInvoice.adminRemarks = null;

      await existingInvoice.save();
      return existingInvoice;
    }

    // 4. Save the Draft Invoice (Status defaults to PENDING_ADMIN_APPROVAL)
    const draftInvoice = await Invoice.create({
      bookingId: dto.bookingId,
      generatedBy: clerkId, // Clerk who made it
      electricityUnitsConsumed: dto.electricityUnitsConsumed,
      electricityCharges,
      cleaningCharges,
      generatorCharges,
      damagesAndPenalties: dto.damagesAndPenalties,
      totalDeductions,
      securityDepositHeld: securityDeposit,
      finalRefundAmount,
      additionalBalanceDue,
      approvalStatus: "PENDING_ADMIN_APPROVAL",
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

    // If Admin Rejects
    if (dto.status === "REJECTED") {
      invoice.approvalStatus = "REJECTED";
      invoice.adminRemarks = dto.adminRemarks;
      invoice.approvedBy = adminId;
      await invoice.save();

      return { message: "Invoice rejected. Sent back to clerk.", invoice };
    }

    // --- IF ADMIN APPROVES ---

    // 1. Process Refund if applicable
    let refundDetails = null;
    let approvalMessage = "Approved successfully."; // Base message

    if (invoice.finalRefundAmount > 0) {
      if (!booking.razorpayPaymentId) {
        invoice.adminRemarks =
          "Approved successfully. Manual refund required (No Payment ID found).";
      } else {
        // 👇 ADDED TRY-CATCH BLOCK HERE 👇
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
          // FALLBACK: If Razorpay fails (due to mock IDs), switch to Manual Mode
          console.warn(
            "⚠️ Auto-refund failed, switching to manual mode:",
            error.message,
          );
          approvalMessage +=
            " ⚠️ Auto-refund failed. MARKED FOR MANUAL REFUND.";
          invoice.adminRemarks = `Manual refund of ₹${invoice.finalRefundAmount} required. (Reason: API Error/Mock ID)`;
        }
        // 👆 END TRY-CATCH BLOCK 👆
      }
    } else {
      invoice.adminRemarks = "Approved successfully. No refund due.";
    }

    // 2. Save Invoice Status
    invoice.approvalStatus = "APPROVED";
    invoice.approvedBy = adminId;
    // Fallback if adminRemarks wasn't set above
    if (!invoice.adminRemarks) invoice.adminRemarks = approvalMessage;
    await invoice.save();

    // 3. Complete the Booking
    booking.status = "CHECKED_OUT"; // Make sure this matches your DB ENUM!
    await booking.save();

    return {
      message: approvalMessage,
      refundId: refundDetails,
      settlementReport: invoice,
    };
  }
}
