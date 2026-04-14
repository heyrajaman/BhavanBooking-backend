import { BookingAccessService } from "../../booking/service/booking.access.service.js";
import { AuditRepository } from "../repository/audit.repository.js";
import sequelize from "../../../config/database.js"; // Needed for transactions
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import { UserService } from "../../user/service/user.service.js";
import SystemSetting from "../model/systemSetting.model.js";
import redisConnection from "../../../config/redis.js";
import { uploadMulterFileToMinio } from "../../../utils/minioUpload.js";

export class AdminService {
  constructor() {
    this.bookingService = new BookingAccessService();
    this.userService = new UserService();
    this.auditRepository = new AuditRepository();
    this.notificationService = new NotificationService();
  }

  async approveBooking(bookingId, adminUserId, revisedTotalAmount) {
    const existingBooking = await this.bookingService.findById(bookingId);

    if (!existingBooking) {
      throw new Error("Booking not found.");
    }

    if (
      existingBooking.status !== "PENDING_ADMIN_APPROVAL" &&
      existingBooking.status !== "PENDING_CLERK_REVIEW"
    ) {
      throw new AppError(
        `Cannot approve booking. Current status is ${existingBooking.status}`,
        400,
      );
    }

    const previousState = existingBooking.toJSON();
    const transaction = await sequelize.transaction();

    try {
      existingBooking.status = "PENDING_PAYMENT";

      if (revisedTotalAmount !== undefined && revisedTotalAmount !== null) {
        if (Number(revisedTotalAmount) < 0) {
          throw new AppError("Revised total amount cannot be negative.", 400);
        }
        existingBooking.calculatedAmount = revisedTotalAmount;
      }

      await existingBooking.save({ transaction });

      await this.auditRepository.logAction(
        "booking",
        bookingId,
        "ADMIN_APPROVAL",
        adminUserId,
        previousState,
        existingBooking.toJSON(),
        transaction,
      );

      await transaction.commit();

      try {
        const user = await existingBooking.getUser();

        if (user && user.email) {
          this.notificationService.sendProvisionalHoldEmail(
            user.email,
            user.fullName,
            existingBooking.id,
            existingBooking.calculatedAmount,
          );
        }
      } catch (emailError) {
        console.error(
          "Failed to fetch user for email notification:",
          emailError,
        );
      }

      return existingBooking;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async uploadAdminSignature(adminId, file) {
    const fileExtension = (
      file.originalname?.split(".").pop() || "png"
    ).toLowerCase();
    const objectName = `signatures/admin-${adminId}-${Date.now()}.${fileExtension}`;

    const { url: signatureUrl } = await uploadMulterFileToMinio({
      file,
      objectName,
      cleanup: true,
    });

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
    const cachedSettings = await redisConnection.get("settings:tax");
    if (cachedSettings) {
      return JSON.parse(cachedSettings);
    }

    let settings = await SystemSetting.findByPk(1);

    if (!settings) {
      settings = await SystemSetting.create({
        cgstPercentage: 2.5,
        sgstPercentage: 2.5,
      });
    }

    await redisConnection.set("settings:tax", JSON.stringify(settings));

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

    await redisConnection.del("settings:tax");

    return settings;
  }
}
