// bbs-backend/src/modules/user/routes/auth.routes.js
import { Router } from "express";
import { AuthController } from "../controller/auth.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { validateDto } from "../../../middlewares/validate.js";
import {
  ChangePasswordDto,
  UserLoginDto,
  UserRegisterDto,
} from "../dto/user.auth.dto.js";
import { protect } from "../../../middlewares/auth.middleware.js";

const router = Router();
const authController = new AuthController();

// POST /api/v1/auth/user/register
// 1. validate middleware checks payload against DTO
// 2. catchAsync handles any errors
// 3. authController processes the request
router.post(
  "/user/register",
  validateDto(UserRegisterDto),
  catchAsync(authController.registerUser),
);

// POST /api/v1/auth/user/login
router.post(
  "/user/login",
  validateDto(UserLoginDto),
  catchAsync(authController.loginUser),
);

// POST /api/v1/auth/user/logout
router.post("/user/logout", catchAsync(authController.logoutUser));

// GET /api/v1/auth/me
router.get("/me", protect, catchAsync(authController.getMyProfile));

// PATCH /api/v1/auth/update-password
router.patch(
  "/update-password",
  protect,
  validateDto(ChangePasswordDto),
  catchAsync(authController.updateMyPassword),
);

export default router;
