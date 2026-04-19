// src/modules/admin/dto/admin.request.dto.js
import Joi from "joi";

export const ApproveBookingDto = Joi.object({
  revisedTotalAmount: Joi.number().min(0).optional().messages({
    "number.base": "Revised total amount must be a number.",
    "number.min": "Revised total amount cannot be negative.",
  }),
  overrideSecurityDeposit: Joi.number().min(0).optional().messages({
    "number.base": "Security deposit override must be a number.",
    "number.min": "Security deposit cannot be negative.",
  }),

  // --- NEW HOLDING LOGIC ---
  isHoldingAllowed: Joi.boolean().optional().default(false),

  // If holding is allowed, percentage is REQUIRED
  holdingPercentage: Joi.when("isHoldingAllowed", {
    is: true,
    then: Joi.number().min(1).max(100).required().messages({
      "number.base": "Holding percentage must be a number.",
      "number.min": "Holding percentage must be at least 1%.",
      "number.max": "Holding percentage cannot exceed 100%.",
      "any.required": "Holding percentage is required when holding is allowed.",
    }),
    otherwise: Joi.forbidden(), // If holding is false, don't accept this field
  }),

  // If holding is allowed, validity days is REQUIRED
  holdingValidityDays: Joi.when("isHoldingAllowed", {
    is: true,
    then: Joi.number().integer().min(1).required().messages({
      "number.base": "Holding validity days must be a number.",
      "number.min": "Holding validity days must be at least 1 day.",
      "any.required":
        "Holding validity days is required when holding is allowed.",
    }),
    otherwise: Joi.forbidden(), // If holding is false, don't accept this field
  }),
}).options({ stripUnknown: true });
