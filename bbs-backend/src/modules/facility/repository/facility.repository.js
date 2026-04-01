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

  /**
   * Fetches a single facility by its primary key (ID).
   */
  async findById(id) {
    return await Facility.findByPk(id);
  }

  /**
   * Fetches all available facilities/packages
   */
  async findAll(filters = {}) {
    const where = { isActive: true };

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        where[key] = { [Op.in]: value };
        return;
      }

      where[key] = value;
    });

    return await Facility.findAll({
      where,
    });
  }

  // Add this inside FacilityRepository class
  async create(facilityData) {
    return await Facility.create(facilityData);
  }

  async update(id, updateData) {
    const facility = await Facility.findByPk(id);
    if (!facility) return null;
    return await facility.update(updateData);
  }

  async delete(id) {
    const facility = await Facility.findByPk(id);
    if (!facility) return null;

    return await facility.update({ isActive: false });
  }
}
