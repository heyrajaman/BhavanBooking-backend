// src/middlewares/error.middleware.js
import multer from "multer";
import { AppError } from "../utils/AppError.js";

const normalizeMulterError = (err) => {
  if (!(err instanceof multer.MulterError)) {
    return err;
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return new AppError("Uploaded file is too large.", 413);
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return new AppError("Too many files uploaded.", 400);
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return new AppError("Unexpected file field in upload.", 400);
  }

  return new AppError("Invalid upload payload.", 400);
};

export const globalErrorHandler = (err, req, res, next) => {
  err = normalizeMulterError(err);

  // Default to 500 Internal Server Error if no status code is set
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log the error to your terminal for debugging
  console.error(`[❌ ERROR] ${err.statusCode} - ${err.message}`);

  // If we are in development, send the full stack trace.
  // In production, we hide the stack trace so we don't leak backend secrets.
  if (process.env.NODE_ENV === "development") {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack,
    });
  }

  // Production Mode (Clean, safe response)
  if (err.isOperational) {
    // This is an error we anticipated (e.g., "Facility already booked")
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown error (e.g., database crashed, syntax error)
    // Don't leak error details to the client
    return res.status(500).json({
      success: false,
      status: "error",
      message: "Something went very wrong. Please try again later.",
    });
  }
};
