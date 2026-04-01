// src/modules/booking/service/booking.service.js
import { BookingRepository } from "../repository/booking.repository.js";
import { FacilityRepository } from "../../facility/repository/facility.repository.js";
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import { Op } from "sequelize";
import Booking from "../model/booking.model.js";
import User from "../../user/model/user.model.js";
import bcrypt from "bcrypt";
import { razorpayInstance } from "../../../config/razorpay.js";
import Invoice from "../../billing/model/invoice.model.js";
import sharp from "sharp";
import minioClient from "../../../config/minio.js";
import { validateFacilitySlots } from "../../../utils/timeValidator.js";

export class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.facilityRepository = new FacilityRepository();
    this.notificationService = new NotificationService();
  }

  async createBooking(userId, bookingData) {
    const { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails } =
      await this._processAndValidateBookingItems(bookingData);

    const newBooking = await this.bookingRepository.create({
      userId,
      facilityId: mainFacilityId, // Null if entirely custom, or main ID if package
      customDetails: customDetails, // Stores the JSON array of ticked boxes
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      eventType: bookingData.eventType,
      guestCount: bookingData.guestCount,
      calculatedAmount: totalAmount,
      securityDeposit: totalSecurityDeposit,
    });

    return { newBooking };
  }

  async processExpiredPayments() {
    // Calculate the cutoff time (24 hours ago)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find all active bookings stuck waiting for advance payment
    const expiredBookings = await Booking.findAll({
      where: {
        status: {
          [Op.in]: ["PENDING_ADVANCE_PAYMENT", "AWAITING_CASH_PAYMENT"],
        },
        updatedAt: {
          [Op.lt]: twentyFourHoursAgo,
        },
      },
    });

    if (expiredBookings.length === 0) {
      console.log("🕒 No expired advance payments found.");
      return;
    }

    // Process cancellations
    for (const booking of expiredBookings) {
      try {
        booking.status = "CANCELLED";
        booking.cancellationReason =
          booking.status === "AWAITING_CASH_PAYMENT"
            ? "Auto-cancelled: Cash payment not marked within 24 hours."
            : "Auto-cancelled: Online advance payment not received within 24 hours.";

        await booking.save();

        // Optional: Notify user
        const user = await booking.getUser();
        if (user && user.email) {
          // You can add a dedicated email template for this later
          console.log(
            `Auto-cancelled booking ${booking.id} for user ${user.email}`,
          );
        }
      } catch (err) {
        console.error(`Failed to cancel booking ${booking.id}:`, err);
      }
    }

    console.log(`🕒 Processed ${expiredBookings.length} expired bookings.`);
  }

  async uploadAadhaarImages(
    bookingId,
    userId,
    frontFile,
    backFile,
    isAdmin = false,
  ) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Authorization: Ensure the user owns the booking (unless an admin/clerk is doing it)
    if (!isAdmin && booking.userId !== userId) {
      throw new AppError(
        "You do not have permission to upload documents for this booking.",
        403,
      );
    }

    // Ensure booking is in a state that allows document uploads
    const invalidStates = [
      "CANCELLED",
      "REJECTED",
      "CHECKED_IN",
      "CHECKED_OUT",
    ];
    if (invalidStates.includes(booking.status)) {
      throw new AppError(
        `Cannot upload documents. Booking is currently ${booking.status}.`,
        400,
      );
    }

    const bucketName = process.env.MINIO_BUCKET_NAME;

    // Helper function to compress and upload a single file
    const processAndUpload = async (file, side) => {
      if (!file || !file.buffer) {
        throw new AppError(
          `Buffer for ${side} image is missing or invalid.`,
          400,
        );
      }

      try {
        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const fileName = `aadhaar/${booking.id}-${side}-${Date.now()}.jpg`;

        await minioClient.putObject(
          bucketName,
          fileName,
          compressedBuffer,
          compressedBuffer.length,
          { "Content-Type": "image/jpeg" },
        );

      const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
        const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : "";
        return `${protocol}://${process.env.MINIO_ENDPOINT}${port}/${bucketName}/${fileName}`;
        
      } catch (sharpError) {
        console.error(`Sharp/Minio Error (${side}):`, sharpError);
        throw new AppError(
          `Failed to process ${side} image: ${sharpError.message}`,
          500,
        );
      }
    };

    // Process both images concurrently for faster response times
    const [frontUrl, backUrl] = await Promise.all([
      processAndUpload(frontFile, "front"),
      processAndUpload(backFile, "back"),
    ]);

    // Save the new URLs to the database model fields we added in Step 1
    booking.aadharFrontImageUrl = frontUrl;
    booking.aadharBackImageUrl = backUrl;
    await booking.save();

    return {
      aadharFrontImageUrl: booking.aadharFrontImageUrl,
      aadharBackImageUrl: booking.aadharBackImageUrl,
    };
  }

  /**
   * STAFF: Processes an offline/walk-in booking
   */
  async createBookingOnBehalf(bookingData, clerkId) {
    // 1. Find or Create the User based on mobile number
    let isNewUser = false;
    let user = await User.findOne({ where: { mobile: bookingData.mobile } });

    const plainTextPassword =
      "WalkInUser@" + Math.floor(1000 + Math.random() * 9000);
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    if (!user) {
      // Create a new user if they don't exist in the system
      user = await User.create({
        fullName: bookingData.fullName,
        mobile: bookingData.mobile,
        email: bookingData.email || null,
        address: bookingData.address || null,
        passwordHash: hashedPassword,
        role: "USER",
      });
      isNewUser = true;
    }

    // 2. Validate availability and calculate price using your existing core logic!
    const { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails } =
      await this._processAndValidateBookingItems(bookingData);

    // 3. Create the Booking
    const newBooking = await this.bookingRepository.create({
      userId: user.id,
      facilityId: mainFacilityId,
      customDetails: customDetails,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      eventType: bookingData.eventType,
      guestCount: bookingData.guestCount,
      calculatedAmount: totalAmount,
      securityDeposit: totalSecurityDeposit,
      status: "PENDING_ADMIN_APPROVAL",
    });

    return { newBooking, user, isNewUser };
  }

  // Replace your existing getUnavailableDates method with this:
  async getUnavailableDates(facilityId) {
    // 1. Get the facility the calendar is trying to load
    const targetFacility = await this.facilityRepository.findById(facilityId);
    if (!targetFacility) throw new AppError("Facility not found.", 404);

    // 2. Fetch ALL upcoming bookings across the entire system
    const allUpcomingBookings =
      await this.bookingRepository.findAllUpcomingActiveBookings();

    const blockedDates = [];

    // 3. Loop through every booking and check if it conflicts with our target facility
    allUpcomingBookings.forEach((booking) => {
      let isConflict = false;

      // --- CASE A: The existing booking is a Custom Tick-Box Booking ---
      if (booking.customDetails && booking.customDetails.length > 0) {
        // Did they directly book our target facility?
        const hasTarget = booking.customDetails.some(
          (item) => item.name === targetFacility.name,
        );

        // Did they book a component that belongs inside our target package?
        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        const blocksPackage = targetInclusions.some((inc) =>
          booking.customDetails.some((item) => item.name === inc),
        );

        // Note: For rooms, we don't fully block the calendar unless all rooms are taken.
        // For now, we block it if it's not a ROOM type.
        if (
          (hasTarget || blocksPackage) &&
          targetFacility.facilityType !== "ROOM"
        ) {
          isConflict = true;
        }
      }

      // --- CASE B: The existing booking is a Standard Package/Hall ---
      if (booking.facility) {
        // 1. Is it the exact same facility?
        if (booking.facility.id === targetFacility.id) isConflict = true;

        // 2. Does the booked package contain our target facility?
        const bookedInclusions =
          booking.facility.pricingDetails?.included_facilities || [];
        if (bookedInclusions.includes(targetFacility.name)) isConflict = true;

        // 3. Does our target package contain the booked package?
        const targetInclusions =
          targetFacility.pricingDetails?.included_facilities || [];
        if (targetInclusions.includes(booking.facility.name)) isConflict = true;

        // 4. Do the two packages share a common sub-component? (e.g., both use the Kitchen)
        const sharedComponents = targetInclusions.filter((inc) =>
          bookedInclusions.includes(inc),
        );
        if (sharedComponents.length > 0) isConflict = true;

        // Allow multiple room bookings to overlap on the calendar visually
        if (isConflict && targetFacility.facilityType === "ROOM") {
          isConflict = false;
        }
      }

      // If a conflict is found, push these dates to the calendar block-out list
      if (isConflict) {
        blockedDates.push({
          start: booking.startTime,
          end: booking.endTime,
          status: booking.status,
        });
      }
    });

    return blockedDates;
  }

  async checkAvailabilityAndPrice(bookingData) {
    try {
      // 1. Check if they are trying to book a standard Package
      if (bookingData.facilityId) {
        const facility = await this.facilityRepository.findById(
          bookingData.facilityId,
        );
        if (!facility) throw new AppError("Facility not found.", 404);

        // Fetch overlaps to see what is taken
        const overlaps = await this.bookingRepository.findOverlappingBookings(
          bookingData.startTime,
          bookingData.endTime,
        );
        let unavailableFacilities = new Set();

        overlaps.forEach((booking) => {
          if (booking.customDetails)
            booking.customDetails.forEach((item) =>
              unavailableFacilities.add(item.name),
            );
          if (booking.facility) {
            unavailableFacilities.add(booking.facility.name);
            if (booking.facility.pricingDetails?.included_facilities) {
              booking.facility.pricingDetails.included_facilities.forEach(
                (inc) => unavailableFacilities.add(inc),
              );
            }
          }
        });

        // 2. Check if the package is entirely blocked or partially blocked
        const packageInclusions =
          facility.pricingDetails?.included_facilities || [];
        let takenComponents = [];
        let availableComponents = [];

        packageInclusions.forEach((inc) => {
          if (unavailableFacilities.has(inc)) {
            takenComponents.push(inc);
          } else {
            availableComponents.push(inc);
          }
        });

        // 3. If there are conflicts inside the package, return the PARTIAL availability response!
        if (takenComponents.length > 0) {
          if (availableComponents.length === 0) {
            return {
              isAvailable: false,
              isPartiallyAvailable: false,
              message: `This package is completely booked for these dates. (${takenComponents.join(", ")} are all taken)`,
            };
          }
          // Fetch the database IDs of the remaining available items so the frontend can easily book them
          const availableFacilitiesDb = await this.facilityRepository.findAll({
            name: takenComponents.length > 0 ? availableComponents : [],
          });

          // Filter our DB results to match only the available names
          const availableToBook = availableFacilitiesDb
            .filter((f) => availableComponents.includes(f.name))
            .map((f) => ({
              facilityId: f.id,
              name: f.name,
              baseRate: f.baseRate,
              quantity: 1, // Default quantity to 1
            }));

          return {
            isAvailable: false,
            isPartiallyAvailable: true,
            message: `The full package is unavailable because ${takenComponents.join(", ")} is already booked. You can book the remaining facilities individually.`,
            unavailableComponents: takenComponents,
            availableAlternatives: availableToBook,
          };
        }
      }

      // 4. If everything is fully available (or it's a Custom booking check), proceed as normal
      const { totalAmount, totalSecurityDeposit } =
        await this._processAndValidateBookingItems(bookingData);

      return {
        isAvailable: true,
        isPartiallyAvailable: false,
        message: "Dates are completely available!",
        pricing: {
          baseCalculatedAmount: totalAmount,
          securityDepositRequired: totalSecurityDeposit,
          estimatedTotal: Number(totalAmount) + Number(totalSecurityDeposit),
        },
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        return {
          isAvailable: false,
          isPartiallyAvailable: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  async getMyBookings(userId) {
    return await this.bookingRepository.findAll({ userId });
  }

  // --- CORE LOGIC ENGINE ---
  async _processAndValidateBookingItems(bookingData) {
    let totalAmount = 0;
    let totalSecurityDeposit = 0;
    let mainFacilityId = bookingData.facilityId || null;
    let customDetails = null;

    // 1. Fetch all overlaps to build a "Set" of unavailable facility names
    const overlaps = await this.bookingRepository.findOverlappingBookings(
      bookingData.startTime,
      bookingData.endTime,
    );
    let unavailableFacilities = new Set();

    overlaps.forEach((booking) => {
      // If they booked custom items, block those specific names
      if (booking.customDetails) {
        booking.customDetails.forEach((item) =>
          unavailableFacilities.add(item.name),
        );
      }
      // If they booked a standard package/hall, block its name and all its sub-components
      if (booking.facility) {
        unavailableFacilities.add(booking.facility.name);
        if (booking.facility.pricingDetails?.included_facilities) {
          booking.facility.pricingDetails.included_facilities.forEach((inc) =>
            unavailableFacilities.add(inc),
          );
        }
      }
    });

    // 2. Process Custom Checkbox Mode
    if (
      bookingData.customFacilities &&
      bookingData.customFacilities.length > 0
    ) {
      customDetails = [];

      for (const item of bookingData.customFacilities) {
        const fac = await this.facilityRepository.findById(item.facilityId);
        if (!fac)
          throw new AppError(`Facility ID ${item.facilityId} not found.`, 404);

        validateFacilitySlots(fac, bookingData.startTime, bookingData.endTime);

        // Conflict check for custom item
        if (
          unavailableFacilities.has(fac.name) &&
          fac.facilityType !== "ROOM"
        ) {
          // Note: Rooms are excluded from strict blocking here to allow multiple people to book different rooms.
          // You can add stricter inventory limits later.
          throw new AppError(
            `${fac.name} is already booked for these dates.`,
            409,
          );
        }

        const quantity = item.quantity || 1;
        let itemTotal = 0;

        // Multiply PER_ITEM (like Mattresses/Rooms), otherwise calculate standard time
        if (fac.pricingType === "PER_ITEM") {
          itemTotal = Number(fac.baseRate) * quantity;
        } else {
          itemTotal =
            this._calculatePrice(
              fac,
              bookingData.startTime,
              bookingData.endTime,
            ) * quantity;
        }

        totalAmount += itemTotal;
        totalSecurityDeposit += Number(fac.securityDeposit);

        customDetails.push({
          facilityId: fac.id,
          name: fac.name,
          quantity: quantity,
          price: itemTotal,
        });
      }
    }
    // 3. Process Standard Package/Hall Mode
    else if (bookingData.facilityId) {
      const facility = await this.facilityRepository.findById(
        bookingData.facilityId,
      );
      if (!facility) throw new AppError("Facility not found.", 404);

      validateFacilitySlots(
        facility,
        bookingData.startTime,
        bookingData.endTime,
      );

      // Check if the package itself is blocked
      if (unavailableFacilities.has(facility.name)) {
        throw new AppError("This package is unavailable for these dates.", 409);
      }

      // Check if any of the sub-components inside the package are blocked
      if (facility.pricingDetails?.included_facilities) {
        for (const inc of facility.pricingDetails.included_facilities) {
          if (unavailableFacilities.has(inc)) {
            throw new AppError(
              `Cannot book this package. Component '${inc}' is already booked by someone else.`,
              409,
            );
          }
        }
      }

      totalAmount = this._calculatePrice(
        facility,
        bookingData.startTime,
        bookingData.endTime,
      );
      totalSecurityDeposit = facility.securityDeposit;
    }

    return { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails };
  }

  // --- STAFF ACTIONS ---

  async rejectBooking(bookingId) {
    // 1. Fetch the booking using your repository
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    // 2. Prevent rejecting bookings that are already finalized
    const unrejectableStates = [
      "CONFIRMED",
      "CHECKED_IN",
      "CHECKED_OUT",
      "CANCELLED",
      "REJECTED",
    ];
    if (unrejectableStates.includes(booking.status)) {
      throw new AppError(
        `Cannot reject a booking that is currently in ${booking.status} state.`,
        400,
      );
    }

    // 3. Update the status
    booking.status = "REJECTED";
    await booking.save();

    try {
      // Fetch the associated user to get their email and name
      const user = await booking.getUser();

      if (user && user.email) {
        // Fire and forget (no 'await')
        const hardcodedReason =
          "The requested facility/time slot is already booked manually.";

        this.notificationService
          .sendBookingRejectionEmail(
            user.email,
            user.fullName,
            booking.id,
            hardcodedReason,
          )
          .catch((err) =>
            console.error("Rejection email failed to send in background:", err),
          );
      }
    } catch (emailError) {
      console.error("Failed to fetch user for rejection email:", emailError);
    }

    return booking;
  }

  // Update the method signature
  async checkInBooking(bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);

    if (!booking) {
      throw new AppError("Booking not found.", 404);
    }

    if (booking.status !== "CONFIRMED") {
      throw new AppError(
        `Cannot check-in. Booking is currently in ${booking.status} state. It must be CONFIRMED.`,
        400,
      );
    }

    // STRICT CHECK: Ensure the payment was completed via Razorpay or the new offline-remaining route
    if (booking.paymentStatus !== "COMPLETED") {
      throw new AppError(
        `Full payment is required before check-in. Current payment status is ${booking.paymentStatus}. Please settle the remaining balance first.`,
        400,
      );
    }

    // Update the booking record
    booking.status = "CHECKED_IN";
    booking.actualCheckInTime = new Date();

    // The payment updates (CASH/QR) are completely removed from here

    await booking.save();

    return booking;
  }

  async checkOutBooking(bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new AppError("Booking not found.", 404);

    // Enforce state machine rules
    if (booking.status !== "CHECKED_IN") {
      throw new AppError(
        `Cannot check-out. Booking is currently in ${booking.status} state. It must be CHECKED_IN.`,
        400,
      );
    }

    booking.status = "CHECKED_OUT";
    // If you add an actualCheckOutTime column to your model, update it here:
    // booking.actualCheckOutTime = new Date();

    await booking.save();

    // NOTE: After checking out, you would typically trigger the BillingService
    // to generate the final invoice for remaining payments.

    return booking;
  }

  /**
   * Generates a report of bookings and revenue within a date range
   */
  async generateReport(dto) {
    const { fromDate, toDate } = dto;

    // Ensure the 'toDate' covers the entire day (up to 23:59:59)
    // so we don't miss bookings made on the last day.
    const endOfDay = new Date(toDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 1. Fetch the bookings within the date range
    const bookings = await Booking.findAll({
      where: {
        createdAt: {
          [Op.between]: [new Date(fromDate), endOfDay],
        },
        status: {
          [Op.notIn]: ["REJECTED"],
        },
      },
      include: [
        {
          model: Invoice,
          as: "invoice",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. Calculate the Summary Data
    const totalBookings = bookings.length;

    const totalRevenue = bookings.reduce((sum, booking) => {
      if (booking.invoice && booking.invoice.approvalStatus === "APPROVED") {
        return sum + parseFloat(booking.invoice.totalAmount || 0);
      }
      const advancePaid = parseFloat(booking.advanceAmountRequested || 0);
      const remainingPaid = parseFloat(booking.remainingAmountPaid || 0);
      const refunded = parseFloat(booking.refundAmount || 0);

      return sum + (advancePaid + remainingPaid - refunded);
    }, 0);

    // 3. Format the response data to match the exact requirements
    const formattedBookings = bookings.map((booking) => ({
      bookingId: booking.id,
      bookingDate: booking.createdAt,
      paymentAmount: booking.invoice
        ? parseFloat(booking.invoice.totalAmount || 0)
        : parseFloat(booking.calculatedAmount || 0),
      status: booking.status,
    }));

    return {
      summary: {
        totalBookings,
        totalRevenue,
      },
      bookings: formattedBookings,
    };
  }

  async getCancellationPolicy() {
    return {
      rules: [
        {
          daysBefore: 30,
          refundPercentage: 50,
          description:
            "If cancelled 30 or more days before check-in, 50% of the advance amount is refunded.",
        },
        {
          daysBefore: 15,
          refundPercentage: 25,
          description:
            "If cancelled between 15 and 29 days before check-in, 25% of the advance amount is refunded.",
        },
        {
          daysBefore: 0,
          refundPercentage: 0,
          description:
            "If cancelled less than 15 days before check-in, no refund is provided.",
        },
      ],
    };
  }

  async cancelBooking(bookingId, userId, userRole, cancellationReason) {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (
      booking.userId !== userId &&
      userRole !== "CLERK" &&
      userRole !== "ADMIN"
    ) {
      throw new AppError(
        "You do not have permission to cancel this booking",
        403,
      );
    }

    if (booking.status === "CANCELLED") {
      throw new AppError("This booking is already cancelled", 400);
    }
    if (booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") {
      throw new AppError(
        "Cannot cancel a booking that is already active or completed",
        400,
      );
    }

    const currentDate = new Date();
    const checkInDate = new Date(booking.startTime);

    if (checkInDate <= currentDate) {
      throw new AppError(
        "Cannot cancel a booking after its check-in time has passed",
        400,
      );
    }

    const diffTime = checkInDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const advanceAmount = Number(booking.advanceAmountRequested || 0);
    let refundPercentage = 0;
    let refundAmount = 0;

    if (booking.status === "CONFIRMED") {
      if (diffDays >= 30) {
        refundPercentage = 50;
      } else if (diffDays >= 15) {
        refundPercentage = 25;
      } else {
        refundPercentage = 0;
      }
      refundAmount = (advanceAmount * refundPercentage) / 100;
    }

    let statusMessage = "Booking cancelled successfully.";

    if (
      refundAmount > 0 &&
      booking.advancePaymentMode === "ONLINE" &&
      booking.razorpayPaymentId
    ) {
      try {
        // Razorpay expects the amount in the smallest currency unit (paise for INR)
        const refundAmountInPaise = Math.round(refundAmount * 100);

        await razorpayInstance.payments.refund(booking.razorpayPaymentId, {
          amount: refundAmountInPaise,
          notes: {
            bookingId: booking.id,
            reason: "Booking Cancellation",
          },
        });

        // Update payment status to reflect the refund
        booking.paymentStatus = "REFUNDED";
        statusMessage =
          "Refund initiated successfully to your original online payment source.";
      } catch (error) {
        console.error("Razorpay Refund Error:", error);
        throw new AppError(
          "Failed to process the refund with Razorpay. Please try again or contact support.",
          500,
        );
      }
    } else if (refundAmount > 0) {
      booking.paymentStatus = "PARTIAL";
      statusMessage = `Booking cancelled. A refund of ₹${refundAmount} is applicable. Please visit the clerk desk to collect your manual refund.`;
    } else if (booking.status !== "CONFIRMED") {
      statusMessage =
        "Booking cancelled. Because no advance payment was made, no refund is required.";
    } else {
      statusMessage =
        "Booking cancelled. As per policy, no refund is applicable for this cancellation window.";
    }

    booking.status = "CANCELLED";
    booking.refundAmount = refundAmount;
    booking.cancelledAt = currentDate;
    booking.cancellationReason = cancellationReason || null;

    await booking.save();

    return {
      bookingId: booking.id,
      status: booking.status,
      refundAmount,
      refundPercentage,
      cancelledAt: booking.cancelledAt,
      message: statusMessage,
    };
  }

  async completeManualRefund(bookingId, staffId, refundNote) {
    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Validation checks
    if (booking.status !== "CANCELLED") {
      throw new AppError("Cannot refund a booking that is not cancelled.", 400);
    }

    if (booking.paymentStatus === "REFUNDED") {
      throw new AppError(
        "This booking has already been completely refunded.",
        400,
      );
    }

    if (booking.advancePaymentMode === "ONLINE" && booking.razorpayPaymentId) {
      throw new AppError(
        "This is an online payment. It should be refunded via Razorpay automatically.",
        400,
      );
    }

    if (!booking.refundAmount || Number(booking.refundAmount) <= 0) {
      throw new AppError(
        "There is no refund amount due for this booking.",
        400,
      );
    }

    // Update the booking to reflect the cash was handed over
    booking.paymentStatus = "REFUNDED";

    // Optional: If you want to store the note, you can append it to customDetails
    // or if you add a 'refundNote' column later. For now, let's safely put it in customDetails.
    const currentDetails = booking.customDetails || {};
    booking.customDetails = {
      ...currentDetails,
      manualRefundConfirmedBy: staffId,
      manualRefundNote: refundNote || "Cash handed over to customer",
      manualRefundDate: new Date(),
    };

    await booking.save();

    return {
      bookingId: booking.id,
      refundAmount: booking.refundAmount,
      paymentStatus: booking.paymentStatus,
      message: "Manual refund marked as completed successfully.",
    };
  }

  _calculatePrice(facility, startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationHours = Math.abs(end - start) / 36e5;
    const durationDays = Math.ceil(durationHours / 24) || 1; // Ensure at least 1 day

    const details = facility.pricingDetails;
    let baseRate = Number(facility.baseRate);
    let total = baseRate;

    switch (facility.pricingType) {
      case "TIERED":
        if (details && durationDays === 1 && details["1_day"])
          total = details["1_day"];
        else if (details && durationDays === 2 && details["2_days"])
          total = details["2_days"];
        else if (details && durationDays >= 3 && details["3_days"]) {
          total =
            details["3_days"] + (durationDays - 3) * Number(facility.baseRate);
        } else {
          total = durationDays * baseRate;
        }
        break;
      case "HOURLY":
        if (details && details.base_hours && details.extra_hour_rate) {
          if (durationHours > details.base_hours) {
            const extraHours = Math.ceil(durationHours - details.base_hours);
            total =
              Number(total) + extraHours * Number(details.extra_hour_rate);
          }
        } else {
          total = Math.ceil(durationHours) * baseRate;
        }
        break;
      case "SLOT":
        if (details && details.slotType === "FIXED" && details.slots) {
          // Extract requested times to match the slot
          const reqStartStr = new Date(startTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const reqEndStr = new Date(endTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });

          // Find the exact slot the user picked to get its specific price
          const matchedSlot = details.slots.find(
            (s) => s.startTime === reqStartStr && s.endTime === reqEndStr,
          );

          if (matchedSlot) {
            total = matchedSlot.price;
          } else {
            // Fallback if somehow it bypassed validation
            total = baseRate;
          }
        } else if (
          details &&
          details.slotType === "FLEXIBLE" &&
          details.durationHours
        ) {
          // For flexible 6-hour packages, it's usually just a flat rate per X hours
          total = Math.ceil(durationHours / details.durationHours) * baseRate;
        }
        break;
      case "FIXED":
        total = durationDays * baseRate;
        break;
      case "PER_ITEM":
        total = baseRate;
        break;
      default:
        total = durationDays * baseRate;
        break;
    }

    return total;
  }
}
