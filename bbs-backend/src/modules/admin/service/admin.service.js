import { BookingAccessService } from "../../booking/service/booking.access.service.js";
import { AuditRepository } from "../repository/audit.repository.js";
import sequelize from "../../../config/database.js"; // Needed for transactions
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import minioClient from "../../../config/minio.js";
import { UserService } from "../../user/service/user.service.js";
import SystemSetting from "../model/systemSetting.model.js";

export class AdminService {
  constructor() {
    this.bookingService = new BookingAccessService();
    this.userService = new UserService();
    this.auditRepository = new AuditRepository();
    this.notificationService = new NotificationService();
  }

  async approveBooking(
    bookingId,
    adminUserId,
    advanceAmountRequested,
    revisedTotalAmount,
  ) {
    // 1. Fetch the existing booking to get the "previous state"
    const existingBooking = await this.bookingService.findById(bookingId);

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

      if (revisedTotalAmount !== undefined && revisedTotalAmount !== null) {
        if (Number(revisedTotalAmount) < 0) {
          throw new AppError("Revised total amount cannot be negative.", 400);
        }
        existingBooking.calculatedAmount = revisedTotalAmount;
      }

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

      try {
        // Fetch the user associated with this booking to get their email
        const user = await existingBooking.getUser();

        if (user && user.email) {
          // Fire and forget (no 'await' so the Admin doesn't have to wait)
          this.notificationService
            .sendProvisionalHoldEmail(
              user.email,
              user.fullName,
              existingBooking.id,
              advanceAmountRequested,
            )
            .catch((err) =>
              console.error(
                "Email failed to send, but booking was approved:",
                err,
              ),
            );
        }
      } catch (emailError) {
        // Catch any unexpected errors fetching the user so it doesn't crash the success response
        console.error(
          "Failed to fetch user for email notification:",
          emailError,
        );
      }

      return existingBooking;
    } catch (error) {
      // If anything fails, undo all changes
      await transaction.rollback();
      throw error;
    }
  }

  async uploadAdminSignature(adminId, file) {
    // 1. Prepare MinIO Upload Details
    const bucketName = process.env.MINIO_BUCKET_NAME;

    // Create a clean, unique file path
    const fileExtension = file.originalname.split(".").pop();
    const fileName = `signatures/admin-${adminId}-${Date.now()}.${fileExtension}`;

    // 2. Push the memory buffer to MinIO
    await minioClient.putObject(
      bucketName,
      fileName,
      file.buffer, // The file data in RAM
      file.size,
      { "Content-Type": file.mimetype },
    );

    // admin.service.js - inside uploadAdminSignature
    const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
    const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : "";

    // Correct URL generation
    const signatureUrl = `${protocol}://${process.env.MINIO_ENDPOINT}${port}/${bucketName}/${fileName}`;

    // 4. Update the Admin's profile in the database
    const admin = await this.userService.findById(adminId);
    if (!admin) {
      throw new AppError("Admin user not found.", 404);
    }

    admin.signatureUrl = signatureUrl;
    await admin.save();

    return signatureUrl; // Return the new URL to the controller
  }

  async getAllBookings(queryFilters) {
    const filters = {};

    // If the frontend passes a status (like ?status=PENDING), we add it to the filter
    if (queryFilters.status) {
      filters.status = queryFilters.status;
    }

    // You can easily expand this later (e.g., filtering by date ranges or facilityId)

    const bookings = await this.bookingService.findAll(filters);

    // If you plan on using your DTO-based architecture here, you could map the
    // raw database models into Response DTOs before returning them.
    return bookings;
  }

  async verifyBookingByClerk(bookingId, clerkUserId) {
    // 1. Fetch the booking
    const booking = await this.bookingService.findById(bookingId);

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

  async getBookingDetails(bookingId) {
    // 1. Fetch the data using our new repository method
    const booking = await this.bookingService.findByIdWithDetails(bookingId);

    // 2. Protect against bad IDs
    if (!booking) {
      throw new AppError("Booking not found or has been deleted.", 404);
    }

    // 3. Return the rich data object
    return booking;
  }

  async getTaxSettings() {
    let settings = await SystemSetting.findByPk(1);

    if (!settings) {
      settings = await SystemSetting.create({
        cgstPercentage: 2.5,
        sgstPercentage: 2.5,
      });
    }
    return settings;
  }

  async updateTaxSettings(cgstPercentage, sgstPercentage) {
    let settings = await SystemSetting.findByPk(1);

    if (!settings) {
      settings = await SystemSetting.create({
        cgstPercentage: 2.5,
        sgstPercentage: 2.5,
      });
    }

    if (cgstPercentage !== undefined) settings.cgstPercentage = cgstPercentage;
    if (sgstPercentage !== undefined) settings.sgstPercentage = sgstPercentage;

    await settings.save();
    return settings;
  }
}
