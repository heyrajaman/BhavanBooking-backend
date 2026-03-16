// src/modules/admin/dto/admin.auth.dto.js
import Joi from "joi";

const mobileRegex = /^[0-9]{10}$/;

// Enforces 8-16 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

export const AdminLoginDto = Joi.object({
  mobile: Joi.string().pattern(mobileRegex).required().messages({
    "string.pattern.base": "Mobile number must be exactly 10 digits.",
    "any.required": "Mobile is required.",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required.",
  }),
}).options({ stripUnknown: true });

export const CreateClerkDto = Joi.object({
  fullName: Joi.string().trim().required().messages({
    "any.required": "FullName is required.",
    "string.empty": "FullName cannot be empty.",
  }),
  mobile: Joi.string().pattern(mobileRegex).required().messages({
    "string.pattern.base": "Mobile number must be exactly 10 digits.",
    "any.required": "Mobile is required.",
  }),
  password: Joi.string().pattern(passwordRegex).required().messages({
    "string.pattern.base":
      "Password must be 8-16 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    "any.required": "Password is required.",
  }),
  email: Joi.string().email().allow(null, "").optional().messages({
    "string.email": "Please provide a valid email address.",
  }),
}).options({ stripUnknown: true });
