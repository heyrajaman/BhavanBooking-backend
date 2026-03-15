// src/modules/facility/controller/facility.controller.js
import { FacilityService } from "../service/facility.service.js";

export class FacilityController {
  constructor() {
    this.facilityService = new FacilityService();
  }

  /**
   * Fetch all available facilities and packages
   */
  getAllFacilities = async (req, res, next) => {
    try {
      const facilities = await this.facilityService.getAllFacilities();

      return res.status(200).json({
        success: true,
        message: "Facilities retrieved successfully",
        data: facilities,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create a new facility or package (Admin Only)
   */
  createFacility = async (req, res, next) => {
    try {
      const facilityData = req.body;

      const newFacility =
        await this.facilityService.createFacility(facilityData);

      return res.status(201).json({
        success: true,
        message: "Facility created successfully.",
        data: newFacility,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update pricing of an existing facility (Admin Only)
   */
  updatePricing = async (req, res, next) => {
    try {
      const { facilityId } = req.params;
      const { baseRate, securityDeposit } = req.body;

      const updatedFacility = await this.facilityService.updateFacilityPricing(
        facilityId,
        baseRate,
        securityDeposit,
      );

      return res.status(200).json({
        success: true,
        message: "Facility pricing updated successfully.",
        data: updatedFacility,
      });
    } catch (error) {
      next(error);
    }
  };
}
