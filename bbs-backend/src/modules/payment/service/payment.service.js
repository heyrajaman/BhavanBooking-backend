// src/modules/payment/service/payment.service.js
import crypto from "crypto";
import { razorpayInstance } from "../../../config/razorpay.js";
import { BookingAccessService } from "../../booking/service/booking.access.service.js";
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import { ADVANCE_PAYMENT_DEADLINE_HOURS } from "../../../constants/payment.constants.js";

export class PaymentService {
  constructor() {
    this.bookingService = new BookingAccessService();
    this.notificationService = new NotificationService();
    this.razorpayInstance = razorpayInstance;
  }

  /**
   * STAFF: Verifies and logs an offline advance payment (Cash/QR)
   */
  async verifyOfflineAdvancePayment(clerkId, paymentData) {
    const { bookingId, paymentMode, amountCollected, paymentOption } =
      paymentData;

    const booking = await this.bookingService.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    const validStatuses = ["PENDING_PAYMENT", "AWAITING_CASH_PAYMENT"];
    if (!validStatuses.includes(booking.status)) {
      throw new AppError(
        `Cannot record advance payment. Booking is currently in ${booking.status} state.`,
        400,
      );
    }

    const now = new Date();
    const timeDiffHours =
      (now - new Date(booking.updatedAt)) / (1000 * 60 * 60);

    if (timeDiffHours > ADVANCE_PAYMENT_DEADLINE_HOURS) {
      booking.status = "CANCELLED";
      booking.cancellationReason = `Advance payment deadline (${ADVANCE_PAYMENT_DEADLINE_HOURS}h) passed.`;
      await booking.save();
      throw new AppError(
        `The ${ADVANCE_PAYMENT_DEADLINE_HOURS}-hour advance payment deadline has passed. The booking has been auto-cancelled.`,
        400,
      );
    }

    if (paymentOption === "HOLD") {
      const msInMonth = 1000 * 60 * 60 * 24 * 30;
      const timeUntilBooking =
        new Date(booking.startTime).getTime() - new Date().getTime();

      if (timeUntilBooking <= msInMonth) {
        throw new AppError(
          "Cannot place this booking on hold. The event is less than 1 month away, so full payment is required.",
          400,
        );
      }
    }

    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);
    let requiredAmount = totalCost;
    if (paymentOption === "HOLD") {
      requiredAmount = totalCost * 0.2;
    }

    if (Number(amountCollected) < requiredAmount) {
      throw new AppError(
        `Collected amount (₹${amountCollected}) is less than the required amount (₹${requiredAmount}).`,
        400,
      );
    }

    // Apply Hold or Full status logic
    if (paymentOption === "HOLD") {
      booking.status = "ON_HOLD";
      booking.paymentStatus = "PARTIAL";
      booking.holdAmountPaid = requiredAmount;

      const msInMonth = 1000 * 60 * 60 * 24 * 30;
      const monthsAway = (new Date(booking.startTime) - new Date()) / msInMonth;
      const deadline = new Date();
      if (monthsAway > 3) {
        deadline.setDate(deadline.getDate() + 30);
      } else {
        deadline.setDate(deadline.getDate() + 7);
      }
      booking.holdDeadline = deadline;
    } else {
      booking.status = "CONFIRMED";
      booking.paymentStatus = "COMPLETED";
    }

    booking.advancePaymentMode = paymentMode;
    booking.advanceCollectedBy = clerkId;

    await booking.save();

    try {
      const user = await booking.getUser();
      if (user && user.email) {
        this.notificationService.sendBookingConfirmationEmail(
          user.email,
          user.fullName,
          booking.id,
        );
      }
    } catch (err) {
      console.error("Failed to fetch user for confirmation email", err);
    }

    return booking;
  }

  /**
   * 1. Creates a Razorpay order for the Initial Payment (Hold or Full)
   */
  async createInitialPaymentOrder(
    userId,
    bookingId,
    paymentOption = "FULL",
    paymentMode = "ONLINE",
  ) {
    const booking = await this.bookingService.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.userId !== userId) {
      throw new AppError(
        "You are not authorized to pay for this booking.",
        403,
      );
    }

    // Checking for the new enum status
    if (booking.status !== "PENDING_PAYMENT") {
      throw new AppError(
        `Cannot initiate payment. Booking status is ${booking.status}.`,
        400,
      );
    }

    if (!booking.aadharFrontImageUrl || !booking.aadharBackImageUrl) {
      throw new AppError(
        "Aadhaar verification required. Please upload both the front and back photos.",
        400,
      );
    }

    // Calculate total cost
    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);

    // Determine the amount based on user's choice
    let amountToPay = totalCost;
    if (paymentOption === "HOLD") {
      const msInMonth = 1000 * 60 * 60 * 24 * 30;
      const timeUntilBooking =
        new Date(booking.startTime).getTime() - new Date().getTime();

      if (timeUntilBooking <= msInMonth) {
        throw new AppError(
          "The 'Hold Date' option is only available for bookings more than 1 month away. Please select full payment to confirm your booking.",
          400,
        );
      }

      amountToPay = totalCost * 0.2;
    }

    if (paymentMode === "CASH" || paymentMode === "QR") {
      booking.status = "AWAITING_CASH_PAYMENT";
      await booking.save();

      return {
        bookingId: booking.id,
        paymentOption: paymentOption,
        paymentMode: paymentMode,
        amountToPay: amountToPay,
        message: `Please pay ₹${amountToPay} at the desk to ${paymentOption === "HOLD" ? "hold" : "confirm"} your booking.`,
      };
    }

    const amountInPaise = Math.round(amountToPay * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `init_${booking.id.replace(/-/g, "")}`.substring(0, 40),
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
      paymentOption: paymentOption, // 'HOLD' or 'FULL'
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * 2. Verifies the Initial Payment and sets Status to ON_HOLD or CONFIRMED
   */
  async verifyInitialPayment(userId, paymentData) {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = paymentData;

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

    const booking = await this.bookingService.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      throw new AppError("Booking not found or unauthorized.", 404);
    }

    const orderDetails = await razorpayInstance.orders.fetch(razorpay_order_id);
    const amountPaidInRupees = orderDetails.amount / 100;

    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);

    const paymentOption =
      amountPaidInRupees < totalCost * 0.5 ? "HOLD" : "FULL";

    if (paymentOption === "HOLD") {
      booking.status = "ON_HOLD";
      booking.paymentStatus = "PARTIAL";
      booking.holdAmountPaid = amountPaidInRupees;

      const msInMonth = 1000 * 60 * 60 * 24 * 30;
      const monthsAway = (new Date(booking.startTime) - new Date()) / msInMonth;

      const deadline = new Date();
      if (monthsAway > 3) {
        deadline.setDate(deadline.getDate() + 30);
      } else {
        deadline.setDate(deadline.getDate() + 7);
      }
      booking.holdDeadline = deadline;
    } else {
      booking.status = "CONFIRMED";
      booking.paymentStatus = "COMPLETED";
    }

    const existingIds = booking.razorpayPaymentIds || [];
    booking.razorpayPaymentIds = [...existingIds, razorpay_payment_id];

    await booking.save();

    try {
      const user = await booking.getUser();
      if (user && user.email) {
        if (paymentOption === "HOLD") {
          this.notificationService.sendHoldConfirmationEmail(
            user.email,
            user.fullName,
            booking.id,
            booking.holdAmountPaid,
            booking.holdDeadline,
          );
        } else {
          this.notificationService.sendBookingConfirmationEmail(
            user.email,
            user.fullName,
            booking.id,
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch user for confirmation email", err);
    }

    return booking;
  }

  /**
   * 3. Creates a Razorpay order for the Remaining Balance
   */
  async createRemainingPaymentOrder(userId, bookingId) {
    const booking = await this.bookingService.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.userId !== userId) {
      throw new AppError(
        "You are not authorized to pay for this booking.",
        403,
      );
    }

    // State Machine Check: Must be CONFIRMED but only PARTIAL payment made
    if (booking.status !== "ON_HOLD" || booking.paymentStatus !== "PARTIAL") {
      throw new AppError(
        "This booking is not eligible for a remaining balance payment. It must be ON HOLD.",
        400,
      );
    }

    // Calculate the Remaining Amount
    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);
    const advancePaid = Number(booking.holdAmountPaid || 0);
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

    const booking = await this.bookingService.findById(bookingId);
    if (!booking || booking.userId !== userId) {
      throw new AppError("Booking not found or unauthorized.", 404);
    }

    // Update the Payment Status to COMPLETED!
    booking.status = "CONFIRMED";
    booking.paymentStatus = "COMPLETED";
    const existingIds = booking.razorpayPaymentIds || [];
    booking.razorpayPaymentIds = [...existingIds, razorpay_payment_id];

    await booking.save();

    return booking;
  }

  async verifyOfflineRemainingPayment(clerkId, paymentData) {
    const { bookingId, paymentMode, amountCollected } = paymentData;

    const booking = await this.bookingService.findById(bookingId);
    if (!booking) throw new AppError("Booking not found", 404);

    if (booking.status !== "ON_HOLD" || booking.paymentStatus !== "PARTIAL") {
      throw new AppError(
        `Cannot record remaining payment. Booking status is ${booking.status}. It must be ON_HOLD.`,
        400,
      );
    }

    // Calculate the Remaining Amount
    const totalCost =
      Number(booking.calculatedAmount) + Number(booking.securityDeposit);
    const advancePaid = Number(booking.holdAmountPaid || 0);
    const remainingAmount = totalCost - advancePaid;

    if (remainingAmount <= 0) {
      throw new AppError("There is no remaining balance left to pay.", 400);
    }

    // Ensure the clerk collected the correct amount
    if (Number(amountCollected) < remainingAmount) {
      throw new AppError(
        `Collected amount (₹${amountCollected}) is less than the required remaining balance (₹${remainingAmount}).`,
        400,
      );
    }

    // Update the Payment Status to COMPLETED
    booking.status = "CONFIRMED";
    booking.paymentStatus = "COMPLETED";

    // You may want to add these fields to your Booking model if they don't exist yet
    booking.remainingPaymentMode = paymentMode; // e.g., "CASH" or "QR"
    booking.remainingCollectedBy = clerkId;

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
