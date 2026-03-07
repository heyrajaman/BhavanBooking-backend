import { Router } from "express";
import { FacilityController } from "../controller/facility.controller.js";
import {
  protectRoute,
  restrictTo,
} from "../../../middlewares/auth.middleware.js";
import { catchAsync } from "../../../utils/catchAsync.js";

const router = Router();
const facilityController = new FacilityController();

// GET /api/v1/facilities (Publicly accessible, no token needed)
router.get("/", catchAsync(facilityController.getAllFacilities));

// POST /api/v1/facilities (Strictly ADMIN only)
router.post(
  "/",
  protectRoute,
  restrictTo("ADMIN"),
  catchAsync(facilityController.createFacility),
);

export default router;
