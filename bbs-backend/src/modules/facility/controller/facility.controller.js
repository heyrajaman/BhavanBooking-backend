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
    const facilities = await this.facilityService.getAllFacilities(startDate, endDate);

    return res.status(200).json({
      success: true,
      message: "Facilities retrieved successfully",
      data: facilities,
    });
  };
  
}
