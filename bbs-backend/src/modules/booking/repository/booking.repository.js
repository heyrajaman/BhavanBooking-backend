// src/modules/booking/repository/booking.repository.js
import { Op } from "sequelize";
import Booking from "../model/booking.model.js";
import User from "../../user/model/user.model.js";
import Facility from "../../facility/model/facility.model.js";

export class BookingRepository {
  // Add this new method right here!
  async findById(id) {
    return await Booking.findByPk(id);
  }

  async create(bookingData, transaction = null) {
    return await Booking.create(bookingData, { transaction });
  }

  async checkFacilityOverlap(
    facilityId,
    startTime,
    endTime,
    excludeBookingId = null,
  ) {
    const whereClause = {
      facilityId: facilityId,
      status: {
        [Op.notIn]: ["CANCELLED", "REJECTED"], // Ignore cancelled or rejected bookings
      },
      [Op.or]: [
        { startTime: { [Op.between]: [startTime, endTime] } },
        { endTime: { [Op.between]: [startTime, endTime] } },
      ],
    };

    // If we pass an ID to exclude (like the booking we are currently verifying), ignore it!
    if (excludeBookingId) {
      whereClause.id = { [Op.ne]: excludeBookingId };
    }

    const overlappingBookings = await Booking.findAll({ where: whereClause });

    return overlappingBookings.length > 0;
  }

  /**
   * Fetches all upcoming bookings for a specific facility to block calendar dates.
   */
  async findActiveBookingsForFacility(facilityId) {
    return await Booking.findAll({
      where: {
        facilityId: facilityId,
        status: {
          [Op.notIn]: ["CANCELLED", "REJECTED"], // Block dates even if they are still pending payment/review
        },
        endTime: {
          [Op.gte]: new Date(), // Only fetch bookings that end today or in the future
        },
      },
      attributes: ["startTime", "endTime", "status"], // Only fetch the data the calendar actually needs
    });
  }

  /**
   * Fetches a list of bookings based on filters (like status)
   * Sorted by newest first.
   */
  async findAll(filters = {}) {
    return await Booking.findAll({
      where: filters,
      order: [["createdAt", "DESC"]], // Show newest bookings at the top
    });
  }

  /**
   * Fetches a booking by ID and includes the associated User and Facility details.
   * Perfect for the Dashboard Detail View.
   */
  async findByIdWithDetails(id) {
    return await Booking.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "fullName", "email", "mobile", "role"], // Ensures we don't accidentally send passwords to the frontend!
        },
        {
          model: Facility,
          as: "facility",
          // You can restrict attributes here too if needed, but for admins, seeing all facility rules is helpful
        },
      ],
    });
  }
}
