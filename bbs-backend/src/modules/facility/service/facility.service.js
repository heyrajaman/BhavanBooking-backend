import Facility from "../model/facility.model.js";

export class FacilityService {
  /**
   * Creates a new facility/venue in the system.
   */
  async createFacility(facilityData) {
    return await Facility.create(facilityData);
  }

  /**
   * Fetches all active facilities.
   */
  async getAllFacilities() {
    return await Facility.findAll({
      where: { isActive: true },
    });
  }
}
