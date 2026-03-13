// src/modules/payment/controller/payment.controller.js
import { PaymentService } from "../service/payment.service.js";

export class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Handles the request to create a Razorpay order for the advance payment
   */
  createAdvanceOrder = async (req, res, next) => {
    // req.user is set by your protect middleware
    const userId = req.user.id;
    const { bookingId } = req.body;

    const orderDetails = await this.paymentService.createAdvancePaymentOrder(
      userId,
      bookingId,
    );

    return res.status(200).json({
      success: true,
      message: "Razorpay advance order created successfully",
      data: orderDetails,
    });
  };

  /**
   * Handles the request from the frontend to verify the payment signature
   */
  verifyAdvance = async (req, res, next) => {
    const userId = req.user.id;
    const paymentData = req.body;

    const confirmedBooking = await this.paymentService.verifyAdvancePayment(
      userId,
      paymentData,
    );

    return res.status(200).json({
      success: true,
      message:
        "Advance payment verified successfully. Booking is now CONFIRMED!",
      data: confirmedBooking,
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
}
