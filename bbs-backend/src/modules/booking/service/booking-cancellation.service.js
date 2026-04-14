import { AppError } from "../../../utils/AppError.js";

export class BookingCancellationService {
  constructor({ bookingModel, razorpayInstance }) {
    this.bookingModel = bookingModel;
    this.razorpayInstance = razorpayInstance;
  }

  _calculateRefund(booking, checkInDate, currentDate) {
    const diffTime = checkInDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const calculatedAmount = Number(booking.calculatedAmount || 0);
    const securityDeposit = Number(booking.securityDeposit || 0);

    let refundPercentage = 0;
    let advanceRefundAmount = 0;

    if (booking.status === "ON_HOLD") {
      totalRefundAmount = securityDeposit * 0.2;
      refundPercentage = 0;
    } else if (booking.status === "CONFIRMED") {
      // User paid 100% of the total.
      if (diffDays >= 30) {
        refundPercentage = 50;
      } else if (diffDays >= 15) {
        refundPercentage = 25;
      } else {
        refundPercentage = 0;
      }

      const baseRefund = (calculatedAmount * refundPercentage) / 100;
      totalRefundAmount = baseRefund + securityDeposit;
    }

    return { totalRefundAmount, refundPercentage };
  }

  getCancellationPolicy() {
    return {
      rules: [
        {
          daysBefore: 30,
          refundPercentage: 50,
          description:
            "If cancelled 30 or more days before check-in, 50% of the advance amount is refunded.",
        },
        {
          daysBefore: 15,
          refundPercentage: 25,
          description:
            "If cancelled between 15 and 29 days before check-in, 25% of the advance amount is refunded.",
        },
        {
          daysBefore: 0,
          refundPercentage: 0,
          description:
            "If cancelled less than 15 days before check-in, no refund is provided.",
        },
        {
          daysBefore: null,
          refundPercentage: 0,
          description:
            "HOLD BOOKINGS: If you have only paid the 20% hold amount, it is strictly non-refundable upon cancellation.",
        },
      ],
    };
  }

  async requestCancellation(bookingId, userId, userRole, cancellationReason) {
    const booking = await this.bookingModel.findByPk(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (
      booking.userId !== userId &&
      userRole !== "CLERK" &&
      userRole !== "ADMIN"
    ) {
      throw new AppError(
        "You do not have permission to cancel this booking",
        403,
      );
    }

    if (
      [
        "CANCELLED",
        "PENDING_CANCELLATION",
        "CHECKED_IN",
        "CHECKED_OUT",
      ].includes(booking.status)
    ) {
      throw new AppError(
        `Cannot cancel a booking in ${booking.status} status`,
        400,
      );
    }

    const currentDate = new Date();
    const checkInDate = new Date(booking.startTime);

    if (checkInDate <= currentDate) {
      throw new AppError(
        "Cannot cancel a booking after its check-in time has passed",
        400,
      );
    }

    // Calculate expected refund but DO NOT process it yet
    const { totalRefundAmount, refundPercentage } = this._calculateRefund(
      booking,
      checkInDate,
      currentDate,
    );

    // Update status to pending
    booking.status = "PENDING_CANCELLATION";
    booking.refundAmount = totalRefundAmount; // Store expected refund
    booking.cancellationReason = cancellationReason || null;
    await booking.save();

    return {
      bookingId: booking.id,
      status: booking.status,
      expectedRefundAmount: totalRefundAmount,
      refundPercentage,
      message:
        "Cancellation request submitted. Awaiting admin approval for refund.",
    };
  }

  // 2. ADMIN APPROVES CANCELLATION & PROCESSES REFUND
  async approveCancellationAndRefund(bookingId, adminId) {
    const booking = await this.bookingModel.findByPk(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.status !== "PENDING_CANCELLATION") {
      throw new AppError(
        "Only bookings in PENDING_CANCELLATION status can be approved for refund.",
        400,
      );
    }

    let statusMessage = "Booking cancelled successfully.";
    const refundAmount = Number(booking.refundAmount || 0);

    // Process Razorpay Refund if applicable
    if (refundAmount > 0 && booking.advancePaymentMode === "ONLINE") {
      try {
        const paymentIds = booking.razorpayPaymentIds || [];

        if (paymentIds.length === 0)
          throw new Error(
            "No Razorpay Payment IDs found for this online booking.",
          );

        let remainingRefundRequired = refundAmount;

        // Loop through all payment IDs (e.g. advance payment + remaining payment) to refund safely
        for (const pId of paymentIds) {
          if (remainingRefundRequired <= 0) break;

          // Fetch original payment to know how much we can legally refund from this specific ID
          const payment = await this.razorpayInstance.payments.fetch(pId);
          const availableToRefundInRupees =
            (payment.amount - payment.amount_refunded) / 100;

          if (availableToRefundInRupees <= 0) continue;

          const amountToRefundFromThisTxn = Math.min(
            remainingRefundRequired,
            availableToRefundInRupees,
          );

          await this.razorpayInstance.payments.refund(pId, {
            amount: Math.round(amountToRefundFromThisTxn * 100),
            notes: { bookingId: booking.id, reason: "Approved Cancellation" },
          });

          remainingRefundRequired -= amountToRefundFromThisTxn;
        }

        booking.paymentStatus = "REFUNDED";
        statusMessage =
          "Cancellation approved. Refund initiated successfully to original online sources.";
      } catch (error) {
        console.error("Razorpay Refund Error:", error);
        throw new AppError(
          "Failed to process the refund with Razorpay. Check logs.",
          500,
        );
      }
    } else if (refundAmount > 0) {
      booking.paymentStatus = "PARTIAL";
      statusMessage = `Cancellation approved. A refund of ₹${refundAmount} is applicable manually.`;
    } else {
      statusMessage = "Cancellation approved. No refund applicable.";
    }

    // Finalize Cancellation
    booking.status = "CANCELLED";
    booking.cancelledAt = new Date();

    // Log who approved it
    booking.customDetails = {
      ...booking.customDetails,
      cancellationApprovedBy: adminId,
      cancellationApprovedAt: new Date(),
    };

    await booking.save();

    return {
      bookingId: booking.id,
      status: booking.status,
      refundAmount: booking.refundAmount,
      paymentStatus: booking.paymentStatus,
      message: statusMessage,
    };
  }

  async completeManualRefund(bookingId, staffId, refundNote) {
    const booking = await this.bookingModel.findByPk(bookingId);

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status !== "CANCELLED") {
      throw new AppError("Cannot refund a booking that is not cancelled.", 400);
    }

    if (booking.paymentStatus === "REFUNDED") {
      throw new AppError(
        "This booking has already been completely refunded.",
        400,
      );
    }

    if (booking.advancePaymentMode === "ONLINE" && booking.razorpayPaymentId) {
      throw new AppError(
        "This is an online payment. It should be refunded via Razorpay automatically.",
        400,
      );
    }

    if (!booking.refundAmount || Number(booking.refundAmount) <= 0) {
      throw new AppError(
        "There is no refund amount due for this booking.",
        400,
      );
    }

    booking.paymentStatus = "REFUNDED";

    const currentDetails = booking.customDetails || {};
    booking.customDetails = {
      ...currentDetails,
      manualRefundConfirmedBy: staffId,
      manualRefundNote: refundNote || "Cash handed over to customer",
      manualRefundDate: new Date(),
    };

    await booking.save();

    return {
      bookingId: booking.id,
      refundAmount: booking.refundAmount,
      paymentStatus: booking.paymentStatus,
      message: "Manual refund marked as completed successfully.",
    };
  }
}
