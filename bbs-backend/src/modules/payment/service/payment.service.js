// src/modules/payment/service/payment.service.js
import crypto from "crypto";
import { razorpayInstance } from "../../../config/razorpay.js";
import { BookingRepository } from "../../booking/repository/booking.repository.js";
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";

export class PaymentService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.notificationService = new NotificationService();
  }

  /**
   * 1. Creates a Razorpay order for the initial Advance Payment
   */
  async createAdvancePaymentOrder(userId, bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.userId !== userId) {
      throw new AppError(
        "You are not authorized to pay for this booking.",
        403,
      );
    }

    if (booking.status !== "PENDING_ADVANCE_PAYMENT") {
      throw new AppError(
        `Cannot initiate advance payment. Booking status is ${booking.status}.`,
        400,
      );
    }

    // Create the Razorpay Order for the Advance Amount
    const amountInPaise = Math.round(
      Number(booking.advanceAmountRequested) * 100,
    );

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `adv_${booking.id.replace(/-/g, "")}`.substring(0, 40),
    };

    const order = await razorpayInstance.orders.create(options);

    // 👇 ADD THIS BLOCK FOR POSTMAN TESTING 👇
    const mockPaymentId = "pay_test_" + Math.floor(Math.random() * 1000000);
    const mockSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order.id + "|" + mockPaymentId)
      .digest("hex");

    console.log("\n=============================================");
    console.log("🧪 POSTMAN TESTING DATA (COPY THESE):");
    console.log(`"razorpay_order_id": "${order.id}"`);
    console.log(`"razorpay_payment_id": "${mockPaymentId}"`);
    console.log(`"razorpay_signature": "${mockSignature}"`);
    console.log("=============================================\n");
    // 👆 END TESTING BLOCK 👆

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking.id,
      paymentType: "ADVANCE",
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * 2. Verifies the Advance Payment and Confirms the Booking
   */
  async verifyAdvancePayment(userId, paymentData, currentUser = null) {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = paymentData;

    // Verify the Razorpay Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new AppError(
        "Invalid payment signature. Payment verification failed.",
        400,
      );
    }

    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      throw new AppError("Booking not found or unauthorized.", 404);
    }

    // Update the Booking Status to CONFIRMED and PARTIAL payment
    booking.paymentStatus = "PARTIAL";
    booking.status = "CONFIRMED";
    await booking.save();

    try {
      // We must fetch the user from the booking to get their email!
      const user = await booking.getUser();

      if (user && user.email) {
        // We don't use 'await' here because we don't want the user to wait for the email
        // to send before getting their success response on the frontend!
        this.notificationService
          .sendBookingConfirmationEmail(user.email, user.fullName, booking.id)
          .catch((err) =>
            console.error("Email failed, but booking confirmed:", err),
          );
      }
    } catch (err) {
      console.error("Failed to fetch user for confirmation email", err);
    }
    // --- BUG FIX ENDS HERE ---

    return booking;
  }

  /**
   * 3. Creates a Razorpay order for the Remaining Balance
   */
  async createRemainingPaymentOrder(userId, bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.userId !== userId) {
      throw new AppError(
        "You are not authorized to pay for this booking.",
        403,
      );
    }

    // State Machine Check: Must be CONFIRMED but only PARTIAL payment made
    if (booking.status !== "CONFIRMED" || booking.paymentStatus !== "PARTIAL") {
      throw new AppError(
        "This booking is not eligible for a remaining balance payment.",
        400,
      );
    }

    // Calculate the Remaining Amount
    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);
    const advancePaid = Number(booking.advanceAmountRequested);
    const remainingAmount = totalCost - advancePaid;

    if (remainingAmount <= 0) {
      throw new AppError("There is no remaining balance left to pay.", 400);
    }

    // Create the Razorpay Order for the Remaining Amount
    const amountInPaise = Math.round(remainingAmount * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `rem_${booking.id.replace(/-/g, "")}`.substring(0, 40),
    };

    const order = await razorpayInstance.orders.create(options);

    // 👇 ADD THIS BLOCK FOR POSTMAN TESTING 👇
    const mockPaymentId = "pay_test_" + Math.floor(Math.random() * 1000000);
    const mockSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(order.id + "|" + mockPaymentId)
      .digest("hex");

    console.log("\n=============================================");
    console.log("🧪 POSTMAN TESTING DATA (COPY THESE):");
    console.log(`"razorpay_order_id": "${order.id}"`);
    console.log(`"razorpay_payment_id": "${mockPaymentId}"`);
    console.log(`"razorpay_signature": "${mockSignature}"`);
    console.log("=============================================\n");
    // 👆 END TESTING BLOCK 👆

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking.id,
      paymentType: "REMAINING",
      remainingAmountToPay: remainingAmount,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * 4. Verifies the Remaining Payment and Marks Payment as COMPLETED
   */
  async verifyRemainingPayment(userId, paymentData) {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = paymentData;

    // Verify the Razorpay Signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      throw new AppError(
        "Invalid payment signature. Payment verification failed.",
        400,
      );
    }

    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      throw new AppError("Booking not found or unauthorized.", 404);
    }

    // Update the Payment Status to COMPLETED!
    booking.paymentStatus = "COMPLETED";
    booking.razorpayPaymentId = razorpay_payment_id;
    await booking.save();

    return booking;
  }

  /**
   * 5. Processes a refund for a specific payment ID
   */
  async processRefund(paymentId, amountInRupees) {
    try {
      if (!paymentId) {
        throw new AppError("Payment ID is required to process a refund.", 400);
      }

      // Razorpay expects the amount in paise
      const amountInPaise = Math.round(Number(amountInRupees) * 100);

      const refund = await razorpayInstance.payments.refund(paymentId, {
        amount: amountInPaise,
        speed: "normal", // 'optimum' or 'normal'
      });

      return refund;
    } catch (error) {
      console.error("DEBUG RAZORPAY ERROR:", error.error || error);
      throw new AppError(
        "Failed to process refund with the payment gateway.",
        500,
      );
    }
  }
}
