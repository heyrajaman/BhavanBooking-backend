import { FacilityService } from "../service/facility.service.js";

export class FacilityController {
  constructor() {
    this.facilityService = new FacilityService();
  }

  createFacility = async (req, res) => {
    // req.body contains the facility details (name, baseRate, etc.)
    const newFacility = await this.facilityService.createFacility(req.body);

    return res.status(201).json({
      success: true,
      message: "Facility added to inventory successfully",
      data: newFacility,
    });
  };

  getAllFacilities = async (req, res) => {
    const facilities = await this.facilityService.getAllFacilities();

    return res.status(200).json({
      success: true,
      data: facilities,
    });
  };
}
