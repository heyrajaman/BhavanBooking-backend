// src/modules/facility/service/facility.service.js
import { FacilityRepository } from "../repository/facility.repository.js";

import { BookingRepository } from "../../booking/repository/booking.repository.js";
export class FacilityService {
  constructor() {
    this.facilityRepository = new FacilityRepository();
    this.bookingRepository = new BookingRepository();
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

  async getAllFacilities(startDate, endDate) {
    // 1. Fetch all facilities from DB
    const facilitiesDb = await this.facilityRepository.findAll();
    
    // Convert Sequelize models to standard JSON objects so we can add new properties
    const facilities = facilitiesDb.map(f => f.toJSON ? f.toJSON() : f);

    // 2. If dates are provided, filter availability!
    if (startDate && endDate) {
      const overlaps = await this.bookingRepository.findOverlappingBookings(startDate, endDate);
      let unavailableNames = new Set();

      // Build a set of everything that is booked (Main packages + Custom Items + Sub-components)
      overlaps.forEach(booking => {
        if (booking.customDetails) {
          booking.customDetails.forEach(item => unavailableNames.add(item.name));
        }
        if (booking.facility) {
          unavailableNames.add(booking.facility.name);
          if (booking.facility.pricingDetails?.included_facilities) {
            booking.facility.pricingDetails.included_facilities.forEach(inc => unavailableNames.add(inc));
          }
        }
      });

      // Mark each facility as available or not
      facilities.forEach(fac => {
        fac.isAvailableForDates = true;

        // Condition A: The facility itself is directly booked
        if (unavailableNames.has(fac.name)) {
           // Allow multiple rooms to still show, but block Halls/Lawns/Packages
           if (fac.facilityType !== 'ROOM') {
              fac.isAvailableForDates = false;
           }
        }

        // Condition B: It's a Package, and one of its sub-items (like Kitchen) is booked
        if (fac.pricingDetails?.included_facilities) {
          const hasBlockedInclusion = fac.pricingDetails.included_facilities.some(inc => unavailableNames.has(inc));
          if (hasBlockedInclusion) {
            fac.isAvailableForDates = false;
          }
        }
      });
    } else {
      // If no dates searched, everything defaults to available for UI purposes
      facilities.forEach(fac => fac.isAvailableForDates = true);
    }

    return facilities;
  }
  
}
