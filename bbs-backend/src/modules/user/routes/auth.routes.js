// bbs-backend/src/modules/user/routes/auth.routes.js
import { Router } from "express";
import { AuthController } from "../controller/auth.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { validateDto } from "../../../middlewares/validate.js";
import { UserLoginDto, UserRegisterDto } from "../dto/user.auth.dto.js";

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

export default router;
