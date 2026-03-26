// src/modules/facility/controller/facility.controller.js
import { FacilityService } from "../service/facility.service.js";

export class FacilityController {
  constructor() {
    this.facilityService = new FacilityService();
  }

  getAllFacilities = async (req, res, next) => {
    // Extract dates from query parameters (if provided)
    const { startDate, endDate } = req.query;

    // Pass dates to service
    const facilities = await this.facilityService.getAllFacilities(
      startDate,
      endDate,
    );

    return res.status(200).json({
      success: true,
      message: "Facilities retrieved successfully",
      data: facilities,
    });
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

  updateFacility = async (req, res, next) => {
    try {
      const { facilityId } = req.params;
      const updateData = { ...req.body };

      const newImageFiles = req.files || [];

      if (
        updateData.pricingDetails &&
        typeof updateData.pricingDetails === "string"
      ) {
        updateData.pricingDetails = JSON.parse(updateData.pricingDetails);
      }

      if (updateData.existingImages) {
        try {
          updateData.images = JSON.parse(updateData.existingImages);
        } catch (e) {
          updateData.images =
            typeof updateData.existingImages === "string"
              ? [updateData.existingImages]
              : updateData.existingImages;
        }
        delete updateData.existingImages;
      } else {
        updateData.images = [];
      }

      if (updateData.amenities && typeof updateData.amenities === "string") {
        try {
          updateData.amenities = JSON.parse(updateData.amenities);
        } catch (e) {
          updateData.amenities = updateData.amenities.split(",");
        }
      }

      const updatedFacility = await this.facilityService.updateFacility(
        facilityId,
        updateData,
        newImageFiles,
      );

      return res.status(200).json({
        success: true,
        message: "Facility details and images updated successfully.",
        data: updatedFacility,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete (Soft Delete) a facility (Admin Only)
   */
  deleteFacility = async (req, res, next) => {
    try {
      const { facilityId } = req.params;

      await this.facilityService.deleteFacility(facilityId);

      return res.status(200).json({
        success: true,
        message: "Facility deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  };
}
