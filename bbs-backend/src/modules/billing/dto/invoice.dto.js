// src/modules/billing/dto/invoice.dto.js
import Joi from "joi";

export const generateInvoiceDto = Joi.object({
  bookingId: Joi.string().uuid().required(),

  // 1. Add the new invoiceType field
  invoiceType: Joi.string().valid("GENERAL", "DONATION").default("GENERAL"),

  // 2. Strict dynamic validation for manual customer details
  customerName: Joi.string().max(50).when("invoiceType", {
    is: "DONATION",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  customerEmail: Joi.string()
    .email()
    .trim()
    .lowercase()
    .when("invoiceType", {
      is: "DONATION",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    }),

  customerPhone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .messages({
      "string.pattern.base":
        "Phone number must be a valid 10-digit Indian mobile number.",
    })
    .when("invoiceType", {
      is: "DONATION",
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ""),
    }),

  billingAddress: Joi.string()
    .max(500)
    .when("invoiceType", {
      is: "DONATION",
      then: Joi.required(),
      otherwise: Joi.allow(null, ""),
    }),

  settlementMode: Joi.string().valid("ONLINE", "CASH", "QR").default("ONLINE"),

  dueDate: Joi.date()
    .iso()
    .when("settlementMode", {
      is: "ONLINE",
      then: Joi.date().min("now").required().messages({
        "any.required": "A future due date is required for online settlements.",
      }),
      otherwise: Joi.date().optional(),
    }),
  // baseAmount is GONE!
  discountAmount: Joi.number().min(0).default(0),

  additionalItems: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        amount: Joi.number().min(1).required(),
      }),
    )
    .optional()
    .default([]),

  electricityUnitsConsumed: Joi.number().integer().min(0).default(0),
  electricityCharges: Joi.number().min(0).default(0),
  cleaningCharges: Joi.number().min(0).default(0),
  generatorCharges: Joi.number().min(0).default(0),

  damagesAndPenalties: Joi.array()
    .items(
      Joi.object({
        reason: Joi.string().required(),
        amount: Joi.number().min(1).required(),
      }),
    )
    .optional()
    .default([]),
});

export const updateInvoiceStatusDto = Joi.object({
  approvalStatus: Joi.string()
    .valid("PENDING_ADMIN_APPROVAL", "APPROVED", "REJECTED")
    .optional(),
  adminRemarks: Joi.string().allow(null, "").when("approvalStatus", {
    is: "REJECTED",
    then: Joi.required(),
  }),
  paymentStatus: Joi.string()
    .valid("PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED", "REFUNDED")
    .optional(),
});
