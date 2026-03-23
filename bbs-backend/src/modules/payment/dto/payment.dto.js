// src/modules/payment/dto/payment.dto.js
import Joi from "joi";

export const VerifyPaymentDto = Joi.object({
  razorpay_order_id: Joi.string().required().messages({
    "any.required": "Razorpay Order ID is required for verification.",
  }),
  razorpay_payment_id: Joi.string().required().messages({
    "any.required": "Razorpay Payment ID is required for verification.",
  }),
  razorpay_signature: Joi.string().required().messages({
    "any.required": "Razorpay Signature is required for verification.",
  }),
  bookingId: Joi.string().uuid().required().messages({
    "string.guid": "Booking ID must be a valid UUID.",
    "any.required": "Booking ID is required.",
  }),
}).options({ stripUnknown: true });

export const OfflineAdvanceDto = Joi.object({
  bookingId: Joi.string().uuid().required(),
  paymentMode: Joi.string().valid("CASH", "QR").required(),
  amountCollected: Joi.number().min(1).required().messages({
    "number.min": "Amount collected must be greater than 0.",
  }),
});
