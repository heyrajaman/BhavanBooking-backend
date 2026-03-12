// src/modules/facility/service/facility.service.js
import { FacilityRepository } from "../repository/facility.repository.js";

export class FacilityService {
  constructor() {
    this.facilityRepository = new FacilityRepository();
  }

  async getAllFacilities() {
    return await this.facilityRepository.findAll();
  }
}
