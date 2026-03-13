import { BookingRepository } from "../../booking/repository/booking.repository.js";
import { AuditRepository } from "../repository/audit.repository.js";
import sequelize from "../../../config/database.js"; // Needed for transactions
import { AppError } from "../../../utils/AppError.js";

export class AdminService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.auditRepository = new AuditRepository();
  }

  /**
   * Admin explicitly approves a booking and requests an advance payment.
   */
  async approveBooking(bookingId, adminUserId, advanceAmountRequested) {
    // 1. Fetch the existing booking to get the "previous state"
    const existingBooking = await this.bookingRepository.findById(bookingId);

    if (!existingBooking) {
      // Assuming you have AppError imported, otherwise throw new Error
      throw new Error("Booking not found.");
    }

    // State Machine Check: Ensure it was verified by a clerk first (or is pending)
    if (
      existingBooking.status !== "PENDING_ADMIN_APPROVAL" &&
      existingBooking.status !== "PENDING_CLERK_REVIEW"
    ) {
      throw new AppError(
        `Cannot approve booking. Current status is ${existingBooking.status}`,
        400,
      );
    }

    if (!advanceAmountRequested || advanceAmountRequested <= 0) {
      throw new Error(
        "An advance payment amount must be specified for approval.",
      );
    }

    const previousState = existingBooking.toJSON();

    // 2. Start a Database Transaction
    const transaction = await sequelize.transaction();

    try {
      // 3. Update the booking status and set the required advance amount
      existingBooking.status = "PENDING_ADVANCE_PAYMENT";
      existingBooking.advanceAmountRequested = advanceAmountRequested;

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

  /**
   * Fetches all bookings, with optional status filtering for the dashboards
   */
  async getAllBookings(queryFilters) {
    const filters = {};

    // If the frontend passes a status (like ?status=PENDING), we add it to the filter
    if (queryFilters.status) {
      filters.status = queryFilters.status;
    }

    // You can easily expand this later (e.g., filtering by date ranges or facilityId)

    const bookings = await this.bookingRepository.findAll(filters);

    // If you plan on using your DTO-based architecture here, you could map the
    // raw database models into Response DTOs before returning them.
    return bookings;
  }

  /**
   * Clerk verifies a pending booking
   */
  async verifyBookingByClerk(bookingId, clerkUserId) {
    // 1. Fetch the booking
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // 2. State Machine Check: Only PENDING bookings can be verified by a Clerk
    if (booking.status !== "PENDING_CLERK_REVIEW") {
      throw new AppError(
        `Cannot verify booking. Current status is ${booking.status}`,
        400,
      );
    }

    // 3. Update the status
    booking.status = "PENDING_ADMIN_APPROVAL";

    // (Optional) If you have an Audit table to track who verified what,
    // you would log the clerkUserId here.

    await booking.save();

    return booking;
  }
}
