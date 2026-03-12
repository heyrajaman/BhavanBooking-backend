// src/modules/booking/repository/booking.repository.js
import { Op } from "sequelize";
import Booking from "../model/booking.model.js";

export class BookingRepository {
  /**
   * Saves the booking to the database.
   */
  async create(bookingData, transaction = null) {
    return await Booking.create(bookingData, { transaction });
  }

  /**
   * Checks if a specific facility is already booked for the given dates.
   */
  async checkFacilityOverlap(facilityId, startTime, endTime) {
    const overlappingBookings = await Booking.findAll({
      where: {
        facilityId: facilityId,
        status: {
          [Op.notIn]: ["CANCELLED", "REJECTED"], // Ignore cancelled or rejected bookings
        },
        [Op.or]: [
          { startTime: { [Op.between]: [startTime, endTime] } },
          { endTime: { [Op.between]: [startTime, endTime] } },
        ],
      },
    });

    return overlappingBookings.length > 0;
  }

  // Note: We removed the old "HOLD" logic here. We will add a new payment expiration query later!
}
