// src/modules/admin/routes/setting.routes.js
import { Router } from "express";
import { AdminController } from "../controller/admin.controller.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";

const router = Router();
const adminController = new AdminController();

// Protect all routes in this file (Admin Only)
router.use(protect);
router.use(restrictTo("ADMIN"));

// GET /api/v1/settings/taxes
router.get("/taxes", adminController.getTaxSettings);

// PATCH /api/v1/settings/taxes
router.patch("/taxes", adminController.updateTaxSettings);

export default router;
