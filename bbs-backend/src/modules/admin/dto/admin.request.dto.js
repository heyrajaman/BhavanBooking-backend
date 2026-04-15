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
}).options({ stripUnknown: true });
