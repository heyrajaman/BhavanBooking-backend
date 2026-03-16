// src/modules/billing/dto/invoice.dto.js
import Joi from "joi";

/**
 * DTO for Clerk generating the preliminary invoice
 */
export const GenerateInvoiceDto = Joi.object({
  electricityUnitsConsumed: Joi.number().integer().min(0).required().messages({
    "number.base": "Electricity units must be a number",
    "number.min": "Electricity units cannot be negative",
  }),

  cleaningCharges: Joi.number().min(0).required().messages({
    "number.base": "Cleaning charges must be a number",
    "number.min": "Cleaning charges cannot be negative",
    "any.required": "Cleaning charges are required",
  }),

  generatorCharges: Joi.number().min(0).required().messages({
    "number.base": "Generator charges must be a number",
    "number.min": "Generator charges cannot be negative",
    "any.required": "Generator charges are required",
  }),
  damagesAndPenalties: Joi.array()
    .items(
      Joi.object({
        reason: Joi.string().required(),
        amount: Joi.number().min(1).required(),
      }),
    )
    .optional()
    .default([]),
  // Note: The actual calculation of charges (units * rate) and
  // cleaning/generator fees will be securely handled by the backend Service,
  // so we don't trust the client to send those amounts directly!
});

/**
 * DTO for Admin approving or rejecting the invoice
 */
export const ApproveInvoiceDto = Joi.object({
  status: Joi.string().valid("APPROVED", "REJECTED").required().messages({
    "any.only": "Status must be either APPROVED or REJECTED",
  }),
  adminRemarks: Joi.string().when("status", {
    is: "REJECTED",
    then: Joi.required().messages({
      "any.required": "Admin remarks are required when rejecting an invoice",
    }),
    otherwise: Joi.optional().allow(""),
  }),
});
