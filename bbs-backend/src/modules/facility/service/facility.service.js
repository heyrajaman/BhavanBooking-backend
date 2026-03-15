// src/modules/facility/service/facility.service.js
import { FacilityRepository } from "../repository/facility.repository.js";

export class FacilityService {
  constructor() {
    this.facilityRepository = new FacilityRepository();
  }

  async getAllFacilities() {
    return await this.facilityRepository.findAll();
  }

  /**
   * Create a new facility (Package or Custom)
   */
  async createFacility(facilityData) {
    // You can add extra validation here if needed, but the DB model will catch most issues
    return await this.facilityRepository.create(facilityData);
  }

  /**
   * Update an existing facility's pricing
   */
  async updateFacilityPricing(facilityId, newBaseRate, newSecurityDeposit) {
    const facility = await this.facilityRepository.findById(facilityId);

    if (!facility) {
      // Assuming you have AppError imported in this file
      throw new Error("Facility not found.");
    }

    const updateData = {};
    if (newBaseRate !== undefined) updateData.baseRate = newBaseRate;
    if (newSecurityDeposit !== undefined)
      updateData.securityDeposit = newSecurityDeposit;

    return await this.facilityRepository.update(facilityId, updateData);
  }
}
