// src/middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";
import { UserRepository } from "../modules/user/repository/user.repository.js";
import { catchAsync } from "../utils/catchAsync.js";

const userRepository = new UserRepository();

export const protect = catchAsync(async (req, res, next) => {
  // 1. Get the token from the Authorization header
  let token;

  if (req.cookies && req.cookies.jwt && req.cookies.jwt !== "loggedout") {
    token = req.cookies.jwt;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );
  }

  // 2. Verify the token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3. Check if the user still exists in the database
  const currentUser = await userRepository.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401),
    );
  }

  // 4. Attach the user to the request object and proceed
  req.user = currentUser;
  next();
});

// Backwards-compatible alias used across route modules
export const protectRoute = protect;

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if the current user's role is in the array of permitted roles
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
