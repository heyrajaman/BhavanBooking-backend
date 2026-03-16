// src/modules/user/dto/user.auth.dto.js
import Joi from "joi";

const mobileRegex = /^[0-9]{10}$/;

// 8-16 chars, at least one uppercase, one lowercase, one number, one special character.
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

export const UserRegisterDto = Joi.object({
  fullName: Joi.string().trim().min(3).required().messages({
    "string.min": "Full name must be at least 3 characters long.",
    "any.required": "Full name is required.",
  }),
  mobile: Joi.string().pattern(mobileRegex).required().messages({
    "string.pattern.base": "Mobile number must be exactly 10 digits.",
    "any.required": "Mobile number is required.",
  }),
  password: Joi.string().pattern(passwordRegex).required().messages({
    "string.pattern.base":
      "Password must be 8-16 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
    "any.required": "Password is required.",
  }),
  email: Joi.string().email().allow(null, "").optional().messages({
    "string.email":
      "Please provide a valid email address format (e.g., example@domain.com).",
  }),
}).options({ stripUnknown: true });

export const UserLoginDto = Joi.object({
  mobile: Joi.string().pattern(mobileRegex).required().messages({
    "string.pattern.base": "Mobile number must be exactly 10 digits.",
    "any.required": "Mobile number is required.",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required.",
  }),
}).options({ stripUnknown: true });
