// src/modules/billing/dto/invoice.dto.js
import Joi from "joi";

export const generateInvoiceDto = Joi.object({
  bookingId: Joi.string().uuid().required(),

  billingAddress: Joi.string().max(500).allow(null, ""),
  dueDate: Joi.date().iso().min("now").required(),

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
