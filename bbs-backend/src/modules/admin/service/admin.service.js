import { BookingRepository } from "../../booking/repository/booking.repository.js";
import { AuditRepository } from "../repository/audit.repository.js";
import sequelize from "../../../config/database.js"; // Needed for transactions

export class AdminService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.auditRepository = new AuditRepository();
  }

  /**
   * Admin explicitly approves a booking that might be flagged or pending.
   */
  async approveBooking(bookingId, adminUserId) {
    // 1. Fetch the existing booking to get the "previous state"
    const existingBooking = await this.bookingRepository.findById(bookingId);

    if (!existingBooking) {
      throw new Error("Booking not found.");
    }

    const previousState = existingBooking.toJSON();

    // 2. Start a Database Transaction
    // A transaction ensures that if the audit log fails to save, the booking status
    // rolls back. We cannot have a status change without a log!
    const transaction = await sequelize.transaction();

    try {
      // 3. Update the booking status
      existingBooking.status = "CONFIRMED";
      await existingBooking.save({ transaction });

      // 4. Log the action in the Audit Trail
      await this.auditRepository.logAction(
        "booking", // entityName
        bookingId, // entityId
        "ADMIN_APPROVAL", // action
        adminUserId, // performedBy
        previousState, // what it looked like before
        existingBooking.toJSON(), // what it looks like now
        transaction,
      );

      // 5. Commit the transaction (save everything permanently)
      await transaction.commit();

      return existingBooking;
    } catch (error) {
      // If anything fails, undo all changes
      await transaction.rollback();
      throw error;
    }
  }
}
