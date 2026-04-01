// src/modules/user/dto/user.auth.dto.js
import Joi from "joi";

const mobileRegex = /^[0-9]{10}$/;

// 8-16 chars, at least one uppercase, one lowercase, one number, one special character.
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

export const UserRegisterDto = Joi.object({
  fullName: Joi.string().trim().min(3).required().messages({
    "string.empty": "Full name cannot be empty.",
    "string.min": "Full name must be at least 3 characters long.",
    "any.required": "Full name is required.",
  }),
  mobile: Joi.string().pattern(mobileRegex).required().messages({
    "string.empty": "Mobile number cannot be empty.",
    "string.pattern.base": "Mobile number must be exactly 10 digits.",
    "any.required": "Mobile number is required.",
  }),
  password: Joi.string().pattern(passwordRegex).required().messages({
    "string.empty": "Password cannot be empty.",
    "string.pattern.base":
      "Password must be 8-16 characters and include an uppercase, lowercase, number, and special character.",
    "any.required": "Password is required.",
  }),
  // This is the fix for the optional email issue!
  email: Joi.string().email().empty("").allow(null).optional().messages({
    "string.email": "Please provide a valid email address format.",
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

export const ChangePasswordDto = Joi.object({
  oldPassword: Joi.string().required().messages({
    "string.empty": "Old password is required",
    "any.required": "Old password is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])"))
    .required()
    .messages({
      "string.empty": "New password is required",
      "string.min": "New password must be at least 8 characters long",
      "string.pattern.base":
        "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "any.required": "New password is required",
    }),
  confirmNewPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Confirm password is required",
    }),
});
