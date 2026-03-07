import crypto from "crypto";
import { razorpayInstance } from "../../../config/razorpay.js";
// In a real app, you would import repositories here to update database statuses
// import { PaymentRepository } from '../repository/payment.repository.js';
// import { BookingRepository } from '../../booking/repository/booking.repository.js';

export class PaymentService {
  /**
   * Generates a standard Razorpay Payment Link.
   * @param {Object} paymentDetails - amount, reference id, customer info
   */
  async generatePaymentLink(paymentDetails) {
    const { amount, referenceId, customerName, customerEmail, customerMobile } =
      paymentDetails;

    // Razorpay expects amount in the smallest currency sub-unit (paise for INR).
    // So ₹100 becomes 10000.
    const amountInPaise = amount * 100;

    const paymentLinkOptions = {
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: referenceId, // We map this to our internal Invoice ID or Booking ID
      description: "Bhavan Booking System Payment",
      customer: {
        name: customerName,
        email: customerEmail,
        contact: customerMobile,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      // The URL to redirect the user to after they pay
      callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      callback_method: "get",
    };

    const paymentLink =
      await razorpayInstance.paymentLink.create(paymentLinkOptions);

    // Here, you would use this.paymentRepository to log the 'PENDING' payment in the DB

    return paymentLink.short_url;
  }

  /**
   * Verifies the cryptographic signature sent by Razorpay's webhook.
   * @param {string} rawBody - The raw JSON string sent by Razorpay
   * @param {string} signature - The 'x-razorpay-signature' header
   */
  async verifyWebhook(rawBody, signature) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // We generate our own signature using the raw payload and our secret
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new Error(
        "Invalid payment signature. Potential tampering detected.",
      );
    }

    // Parse the body now that we know it's safe
    const payload = JSON.parse(rawBody);

    if (payload.event === "payment_link.paid") {
      const paymentEntity = payload.payload.payment_link.entity;
      const referenceId = paymentEntity.reference_id;
      const amountPaid = paymentEntity.amount_paid / 100;

      console.log(
        `[PaymentService] Verified payment of ₹${amountPaid} for Reference: ${referenceId}`,
      );

      // Here you would:
      // 1. Update Payment status to 'SUCCESS' in DB
      // 2. If it's the 20% advance, leave Booking status as 'HOLD' but mark advance as paid.
      // 3. If it's the full advance + security deposit, update Booking status to 'CONFIRMED'.
    }

    return true;
  }
}
