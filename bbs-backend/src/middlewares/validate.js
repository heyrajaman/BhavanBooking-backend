import { AppError } from "../utils/AppError.js";

/**
 * Professional DTO Validation Middleware.
 * Instantiates the DTO, validates it, and attaches the clean object to the request.
 */
export const validateDto = (DtoClass) => {
  return (req, res, next) => {
    try {
      // 1. Create the DTO instance from the raw incoming data
      const cleanDto = new DtoClass(req.body);

      // 2. Run the validation logic (throws an error if missing fields)
      cleanDto.isValid();

      // 3. The Professional Move: Overwrite req.body with the sanitized DTO!
      // Now, any malicious extra fields sent by a hacker are completely stripped out.
      req.body = cleanDto;

      next(); // Move to the next middleware or controller
    } catch (error) {
      // If validation fails, immediately kick them out with a 400 Bad Request
      next(new AppError(error.message, 400));
    }
  };
};
