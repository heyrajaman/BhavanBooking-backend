// src/modules/admin/routes/admin.auth.routes.js
import { Router } from "express";
import { AdminAuthController } from "../controller/admin.auth.controller.js";
import { validateDto } from "../../../middlewares/validate.js";
import { AdminLoginDto, CreateClerkDto } from "../dto/admin.auth.dto.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";

const router = Router();
const adminAuthController = new AdminAuthController();

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

export default router;
