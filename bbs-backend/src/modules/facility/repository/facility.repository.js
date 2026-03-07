import Facility from "../model/facility.model.js";
import { Op } from "sequelize";

export class FacilityRepository {
  /**
   * Fetches multiple facilities matching an array of IDs.
   */
  async findByIds(facilityIds) {
    return await Facility.findAll({
      where: {
        id: {
          [Op.in]: facilityIds,
        },
      },
    });
  }
}
