// src/middlewares/validate.js
import { AppError } from "../utils/AppError.js";

/**
 * Middleware to validate incoming request data using Joi schemas.
 * @param {Object} schema - The Joi schema to validate against.
 * @param {String} source - The property of the request to validate (e.g., 'body', 'query', 'params'). Defaults to 'body'.
 */
export const validateDto = (schema, source = "body") => {
  return (req, res, next) => {
    // We use abortEarly: false so Joi returns ALL validation errors, not just the first one it finds.
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
    });

    if (error) {
      // Extract all error messages and join them into a single readable string
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join("; ");
      return next(new AppError(errorMessage, 400));
    }

    // Replace the request data with the validated value.
    // Because we used .options({ stripUnknown: true }) in our DTOs,
    // this also safely removes any extra malicious fields!
    req[source] = value;

    next();
  };
};
