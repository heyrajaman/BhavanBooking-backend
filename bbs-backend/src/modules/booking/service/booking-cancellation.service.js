import { AppError } from "../../../utils/AppError.js";

export class BookingCancellationService {
  constructor({ bookingModel, razorpayInstance }) {
    this.bookingModel = bookingModel;
    this.razorpayInstance = razorpayInstance;
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
      ],
    };
  }

  async cancelBooking(bookingId, userId, userRole, cancellationReason) {
    const booking = await this.bookingModel.findByPk(bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

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

    if (booking.status === "CANCELLED") {
      throw new AppError("This booking is already cancelled", 400);
    }
    if (booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") {
      throw new AppError(
        "Cannot cancel a booking that is already active or completed",
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

    const diffTime = checkInDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const advanceAmount = Number(booking.advanceAmountRequested || 0);
    let refundPercentage = 0;
    let refundAmount = 0;

    if (booking.status === "CONFIRMED") {
      if (diffDays >= 30) {
        refundPercentage = 50;
      } else if (diffDays >= 15) {
        refundPercentage = 25;
      } else {
        refundPercentage = 0;
      }
      refundAmount = (advanceAmount * refundPercentage) / 100;
    }

    let statusMessage = "Booking cancelled successfully.";

    if (
      refundAmount > 0 &&
      booking.advancePaymentMode === "ONLINE" &&
      booking.razorpayPaymentId
    ) {
      try {
        const refundAmountInPaise = Math.round(refundAmount * 100);

        await this.razorpayInstance.payments.refund(booking.razorpayPaymentId, {
          amount: refundAmountInPaise,
          notes: {
            bookingId: booking.id,
            reason: "Booking Cancellation",
          },
        });

        booking.paymentStatus = "REFUNDED";
        statusMessage =
          "Refund initiated successfully to your original online payment source.";
      } catch (error) {
        console.error("Razorpay Refund Error:", error);
        throw new AppError(
          "Failed to process the refund with Razorpay. Please try again or contact support.",
          500,
        );
      }
    } else if (refundAmount > 0) {
      booking.paymentStatus = "PARTIAL";
      statusMessage = `Booking cancelled. A refund of ₹${refundAmount} is applicable. Please visit the clerk desk to collect your manual refund.`;
    } else if (booking.status !== "CONFIRMED") {
      statusMessage =
        "Booking cancelled. Because no advance payment was made, no refund is required.";
    } else {
      statusMessage =
        "Booking cancelled. As per policy, no refund is applicable for this cancellation window.";
    }

    booking.status = "CANCELLED";
    booking.refundAmount = refundAmount;
    booking.cancelledAt = currentDate;
    booking.cancellationReason = cancellationReason || null;

    await booking.save();

    return {
      bookingId: booking.id,
      status: booking.status,
      refundAmount,
      refundPercentage,
      cancelledAt: booking.cancelledAt,
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
