// src/modules/facility/routes/facility.routes.js
import { Router } from "express";
import { FacilityController } from "../controller/facility.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";

const router = Router();
const facilityController = new FacilityController();

// GET /api/v1/facilities - Public route to fetch all packages
router.get("/", catchAsync(facilityController.getAllFacilities));

router.use(protect);
router.use(restrictTo("ADMIN"));

router.post("/", catchAsync(facilityController.createFacility));

router.patch(
  "/:facilityId/pricing",
  catchAsync(facilityController.updatePricing),
);

router.patch("/:facilityId", catchAsync(facilityController.updateFacility));

router.delete("/:facilityId", catchAsync(facilityController.deleteFacility));

export default router;
