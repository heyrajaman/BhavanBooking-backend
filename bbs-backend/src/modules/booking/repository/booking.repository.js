import { Op } from "sequelize";
import Booking from "../model/booking.model.js";
// Note: In ES Modules, we must include the .js extension in local imports.

export class BookingRepository {
  /**
   * Checks if a facility is already booked for the given dates.
   * This handles the "First Come, First Served" requirement.
   */
  async checkFacilityOverlap(facilityIds, startDatetime, endDatetime) {
    // In a real implementation, we would also query the BookingFacility junction table.
    // We look for any overlapping dates where status is not CANCELLED.
    const overlappingBookings = await Booking.findAll({
      where: {
        status: {
          [Op.ne]: "CANCELLED", // Ignore cancelled bookings
        },
        [Op.or]: [
          {
            startDatetime: { [Op.between]: [startDatetime, endDatetime] },
          },
          {
            endDatetime: { [Op.between]: [startDatetime, endDatetime] },
          },
        ],
      },
    });

    return overlappingBookings.length > 0;
  }

  /**
   * Saves the booking to the database.
   */
  async createBooking(bookingData, transaction = null) {
    return await Booking.create(bookingData, { transaction });
  }

  /**
   * Finds all HOLD bookings that were created before a specific date.
   */
  async findExpiredHolds(cutoffDate) {
    return await Booking.findAll({
      where: {
        status: "HOLD",
        createdAt: {
          [Op.lt]: cutoffDate, // less than (older than) the cutoff date
        },
      },
    });
  }

  /**
   * Bulk updates the status of specific bookings.
   */
  async cancelBookings(bookingIds) {
    return await Booking.update(
      { status: "CANCELLED" },
      {
        where: {
          id: { [Op.in]: bookingIds },
        },
      },
    );
  }
}
