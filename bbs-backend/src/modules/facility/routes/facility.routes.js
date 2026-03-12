// src/modules/facility/routes/facility.routes.js
import { Router } from "express";
import { FacilityController } from "../controller/facility.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";

const router = Router();
const facilityController = new FacilityController();

// GET /api/v1/facilities - Public route to fetch all packages
router.get("/", catchAsync(facilityController.getAllFacilities));

export default router;
