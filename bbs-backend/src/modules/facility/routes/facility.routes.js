// src/modules/facility/routes/facility.routes.js
import { Router } from "express";
import { FacilityController } from "../controller/facility.controller.js";
import { catchAsync } from "../../../utils/catchAsync.js";
import { protect, restrictTo } from "../../../middlewares/auth.middleware.js";
import { uploadImage } from "../../../middlewares/upload.middleware.js";
import { CreateFacilityDto } from "../dto/facility.dto.js";
import { validateDto } from "../../../middlewares/validate.js";

const router = Router();
const facilityController = new FacilityController();

// Middleware to parse stringified JSON from form-data safely
const parseFacilityFormData = (req, res, next) => {
  // 1. Safety check: If Multer failed and body is missing, create an empty object
  if (!req.body) {
    req.body = {};
  }

  try {
    // 2. Parse pricingDetails if it exists
    if (
      req.body.pricingDetails &&
      typeof req.body.pricingDetails === "string"
    ) {
      req.body.pricingDetails = JSON.parse(req.body.pricingDetails);
    }

    // 3. Parse amenities if it exists
    if (req.body.amenities && typeof req.body.amenities === "string") {
      req.body.amenities = JSON.parse(req.body.amenities);
    }

    next();
  } catch (error) {
    // Catch JSON parsing errors (e.g., if you forgot quotes in Postman)
    return res.status(400).json({
      success: false,
      message:
        "Invalid JSON string format in pricingDetails or amenities. Please check your form-data syntax.",
    });
  }
};

// GET /api/v1/facilities - Public route to fetch all packages
router.get("/", catchAsync(facilityController.getAllFacilities));

router.use(protect);
router.use(restrictTo("ADMIN"));

router.post(
  "/",
  uploadImage.array("images", 5),
  parseFacilityFormData,
  validateDto(CreateFacilityDto),
  catchAsync(facilityController.createFacility),
);

router.patch(
  "/:facilityId/pricing",
  catchAsync(facilityController.updatePricing),
);

router.patch(
  "/:facilityId",
  uploadImage.array("newImages", 5),
  catchAsync(facilityController.updateFacility),
);

router.delete("/:facilityId", catchAsync(facilityController.deleteFacility));

export default router;
