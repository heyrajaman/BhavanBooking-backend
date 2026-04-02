export class BillingApprovalSettlementService {
  constructor({ paymentService }) {
    this.paymentService = paymentService;
  }

  async applySettlement(invoice, booking) {
    let refundDetails = null;
    let approvalMessage = "Approved successfully.";

    if (invoice.finalRefundAmount > 0) {
      if (["CASH", "QR"].includes(invoice.settlementMode)) {
        approvalMessage += ` Manual CASH refund of ₹${invoice.finalRefundAmount} to be handed to customer.`;
        invoice.adminRemarks = approvalMessage;
        invoice.paymentStatus = "REFUNDED";
      } else {
        if (!booking.razorpayPaymentId) {
          invoice.adminRemarks =
            "Approved successfully. Manual refund required (No Payment ID found).";
        } else {
          try {
            const refundResponse = await this.paymentService.processRefund(
              booking.razorpayPaymentId,
              invoice.finalRefundAmount,
            );
            refundDetails = refundResponse.id;
            approvalMessage += ` Automatic online refund initiated (Refund ID: ${refundDetails}).`;
            invoice.adminRemarks = approvalMessage;
            invoice.paymentStatus = "REFUNDED";
          } catch (error) {
            console.warn("⚠️ Auto-refund failed:", error.message);
            approvalMessage +=
              " ⚠️ Auto-refund failed. MARKED FOR MANUAL REFUND.";
            invoice.adminRemarks = `Manual refund of ₹${invoice.finalRefundAmount} required. (API Error)`;
          }
        }
      }
    } else if (invoice.additionalBalanceDue > 0) {
      if (["CASH", "QR"].includes(invoice.settlementMode)) {
        approvalMessage += ` Additional CASH payment of ₹${invoice.additionalBalanceDue} collected at check-out.`;
        invoice.adminRemarks = approvalMessage;
        invoice.paymentStatus = "PAID";
      } else {
        invoice.adminRemarks =
          "Approved successfully. Awaiting online payment of remaining balance.";
      }
    } else {
      invoice.adminRemarks = "Approved successfully. No refund or balance due.";
      invoice.paymentStatus = "PAID";
    }

    if (invoice.additionalBalanceDue === 0 && invoice.totalAmount > 0) {
      invoice.paymentStatus = "PAID";
    }

    if (!invoice.adminRemarks) {
      invoice.adminRemarks = approvalMessage;
    }

    return { approvalMessage, refundDetails };
  }
}
