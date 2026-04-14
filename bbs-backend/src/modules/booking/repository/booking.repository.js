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

  async findOverlappingBookings(startTime, endTime, excludeBookingId = null) {
    const whereClause = {
      status: {
        [Op.notIn]: ["CANCELLED", "REJECTED"],
      },
      [Op.and]: [
        { startTime: { [Op.lt]: endTime } },
        { endTime: { [Op.gt]: startTime } },
      ],
    };

    if (excludeBookingId) {
      whereClause.id = { [Op.ne]: excludeBookingId };
    }

    return await Booking.findAll({
      where: whereClause,
      include: [{ model: Facility, as: "facility" }],
    });
  }

  async checkFacilityOverlap(
    facilityId,
    startTime,
    endTime,
    excludeBookingId = null,
  ) {
    const overlaps = await this.findOverlappingBookings(
      startTime,
      endTime,
      excludeBookingId,
    );
    return overlaps.some((booking) => booking.facilityId === facilityId);
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
      include: [
        {
          model: Facility,
          as: "facility", // This matches the alias in your Booking.associate method
          attributes: ["id", "name", "description", "facilityType"], // Added description here
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "fullName", "email", "mobile"], // Restrict fields to what the dashboard needs
        },
      ],
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

  // Add this inside BookingRepository class
  async findAllUpcomingActiveBookings() {
    return await Booking.findAll({
      where: {
        status: { [Op.notIn]: ["CANCELLED", "REJECTED"] },
        endTime: { [Op.gte]: new Date() }, // Only future/current bookings
      },
      include: [{ model: Facility, as: "facility" }],
    });
  }

  async findExpiredInitialPayments(cutoffTime) {
    return await Booking.findAll({
      where: {
        status: "PENDING_PAYMENT",
        updatedAt: {
          [Op.lt]: cutoffTime,
        },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "fullName"],
          required: false,
        },
      ],
    });
  }

  async findExpiredHoldBookings(currentDate = new Date()) {
    return await Booking.findAll({
      where: {
        status: "ON_HOLD",
        holdDeadline: {
          [Op.lt]: currentDate,
        },
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "email", "fullName"],
          required: false,
        },
      ],
    });
  }
}
