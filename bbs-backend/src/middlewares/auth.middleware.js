import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

/**
 * Middleware to verify if the user is logged in (has a valid token).
 */
export const protectRoute = (req, res, next) => {
  try {
    let token;

    // Check if the token was sent in the Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError(
        "You are not logged in. Please log in to get access.",
        401,
      );
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user payload (id, role) to the Express request object
    // This allows subsequent controllers to know exactly who made the request
    req.user = decoded;

    next(); // Pass control to the next middleware or controller
  } catch (error) {
    // Catch expired or tampered tokens
    next(new AppError("Invalid or expired token. Please log in again.", 401));
  }
};

/**
 * Middleware to restrict access based on user roles.
 * @param {...string} roles - An array of allowed roles (e.g., 'ADMIN', 'CLERK')
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the protectRoute middleware
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403),
      );
    }
    next();
  };
};
