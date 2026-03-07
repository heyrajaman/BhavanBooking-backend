import { Router } from "express";
import { AuthController } from "../controller/auth.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";

const router = Router();
const authController = new AuthController();

// POST /api/v1/auth/register
router.post("/register", catchAsync(authController.register));

// POST /api/v1/auth/login
router.post("/login", catchAsync(authController.login));

export default router;
