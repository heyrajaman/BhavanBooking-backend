// src/modules/payment/controller/payment.controller.js
import { PaymentService } from "../service/payment.service.js";

export class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * STAFF: Records an offline (Cash/QR) advance payment
   */
  verifyOfflineAdvance = async (req, res, next) => {
    const clerkId = req.user.id;
    const paymentData = req.body;

    const confirmedBooking =
      await this.paymentService.verifyOfflineAdvancePayment(
        clerkId,
        paymentData,
      );

    return res.status(200).json({
      success: true,
      message: `Offline advance payment recorded successfully. Booking is now CONFIRMED!`,
      data: confirmedBooking,
    });
  };

  /**
   * Handles the request to create a Razorpay order for the initial payment (Hold/Full)
   */
  createInitialOrder = async (req, res, next) => {
    const userId = req.user.id;
    // paymentOption should be sent from frontend: "HOLD" or "FULL"
    const { bookingId, paymentOption, paymentMode } = req.body;

    const orderDetails = await this.paymentService.createInitialPaymentOrder(
      userId,
      bookingId,
      paymentOption,
      paymentMode,
    );

    return res.status(200).json({
      success: true,
      message: "Razorpay order created successfully",
      data: orderDetails,
    });
  };

  /**
   * Handles the request from the frontend to verify the payment signature
   */
  verifyInitialPayment = async (req, res, next) => {
    const userId = req.user.id;
    const paymentData = req.body;

    const updatedBooking = await this.paymentService.verifyInitialPayment(
      userId,
      paymentData,
    );

    const msg =
      updatedBooking.status === "ON_HOLD"
        ? "Hold payment verified successfully. Booking is now ON HOLD."
        : "Full payment verified successfully. Booking is now CONFIRMED!";

    return res.status(200).json({
      success: true,
      message: msg,
      data: updatedBooking,
    });
  };

  /**
   * Handles the request to create a Razorpay order for the remaining balance
   */
  createRemainingOrder = async (req, res, next) => {
    const userId = req.user.id;
    const { bookingId } = req.body;

    const orderDetails = await this.paymentService.createRemainingPaymentOrder(
      userId,
      bookingId,
    );

    return res.status(200).json({
      success: true,
      message: "Razorpay order for remaining balance created successfully",
      data: orderDetails,
    });
  };

  /**
   * Handles the request to verify the remaining payment signature
   */
  verifyRemaining = async (req, res, next) => {
    const userId = req.user.id;
    const paymentData = req.body;

    const completedBooking = await this.paymentService.verifyRemainingPayment(
      userId,
      paymentData,
    );

    return res.status(200).json({
      success: true,
      message:
        "Remaining payment verified successfully. Payment is now COMPLETED!",
      data: completedBooking,
    });
  };

  verifyOfflineRemaining = async (req, res, next) => {
    // req.user is extracted from your protect/auth middleware
    const clerkId = req.user.id;
    const paymentData = req.body;

    const completedBooking =
      await this.paymentService.verifyOfflineRemainingPayment(
        clerkId,
        paymentData,
      );

    return res.status(200).json({
      success: true,
      message:
        "Offline remaining payment recorded successfully. Payment is now COMPLETED!",
      data: completedBooking,
    });
  };
}
