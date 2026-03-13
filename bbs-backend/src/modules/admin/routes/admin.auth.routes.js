// src/modules/admin/routes/admin.auth.routes.js
import { Router } from "express";
import { AdminAuthController } from "../controller/admin.auth.controller.js";
import { AdminController } from "../controller/admin.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import { AdminLoginDto, CreateClerkDto } from "../dto/admin.auth.dto.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";

const router = Router();
const adminAuthController = new AdminAuthController();
const adminController = new AdminController();

// POST /api/v1/auth/admin/login (ONLY for Admins)
router.post(
  "/login",
  validateDto(AdminLoginDto),
  catchAsync(adminAuthController.adminLogin),
);

// POST /api/v1/auth/admin/clerk/login (ONLY for Clerks)
router.post(
  "/clerk/login",
  validateDto(AdminLoginDto),
  catchAsync(adminAuthController.clerkLogin),
);

// POST /api/v1/auth/admin/create-clerk (Protected & Restricted)
router.post(
  "/create-clerk",
  protect,
  restrictTo("ADMIN"),
  validateDto(CreateClerkDto),
  catchAsync(adminAuthController.createClerk),
);

// GET /api/v1/auth/admin/bookings (For both Admin and Clerk)
router.get(
  "/bookings",
  protect,
  restrictTo("ADMIN", "CLERK"), // Both roles need to see the list
  catchAsync(adminController.getAllBookings),
);

// PATCH /api/v1/auth/admin/bookings/:bookingId/verify (ONLY for Clerks)
router.patch(
  "/bookings/:bookingId/verify",
  protect,
  restrictTo("CLERK"), // Only logged-in clerks can perform this action
  catchAsync(adminController.verifyByClerk),
);

// PATCH /api/v1/auth/admin/bookings/:bookingId/approve (ONLY for Admins)
router.patch(
  "/bookings/:bookingId/approve",
  protect,
  restrictTo("ADMIN"), // Only logged-in Admins can perform this action
  catchAsync(adminController.approveBooking),
);

export default router;
