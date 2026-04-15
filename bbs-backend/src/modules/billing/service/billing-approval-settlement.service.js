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
        const paymentIds = booking.razorpayPaymentIds || [];

        if (paymentIds.length === 0) {
          invoice.adminRemarks =
            "Approved successfully. Manual refund required (No Payment ID found).";
        } else {
          try {
            let remainingRefundRequired = invoice.finalRefundAmount;
            const processedRefundIds = [];

            for (const pId of paymentIds) {
              if (remainingRefundRequired <= 0) break;

              if (pId.startsWith("pay_test_")) {
                console.log(`🧪 Mocking Razorpay refund for test ID: ${pId}`);
                processedRefundIds.push("mock_refund_id");
                remainingRefundRequired -= remainingRefundRequired;
                continue;
              }

              const payment =
                await this.paymentService.razorpayInstance.payments.fetch(pId);
              const availableToRefundInRupees =
                (payment.amount - payment.amount_refunded) / 100;

              if (availableToRefundInRupees <= 0) continue;

              const amountToRefundFromThisTxn = Math.min(
                remainingRefundRequired,
                availableToRefundInRupees,
              );

              const refundResponse =
                await this.paymentService.razorpayInstance.payments.refund(
                  pId,
                  {
                    amount: Math.round(amountToRefundFromThisTxn * 100),
                    notes: {
                      invoiceId: invoice.id,
                      reason: "Security Deposit Settlement",
                    },
                  },
                );

              processedRefundIds.push(refundResponse.id);
              remainingRefundRequired -= amountToRefundFromThisTxn;
            }

            refundDetails = processedRefundIds.join(", ");
            approvalMessage += ` Automatic online refund initiated (Refund IDs: ${refundDetails}).`;
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
