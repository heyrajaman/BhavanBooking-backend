// src/modules/booking/service/booking.service.js
import { BookingRepository } from "../repository/booking.repository.js";
import { FacilityService } from "../../facility/service/facility.service.js";
import { AppError } from "../../../utils/AppError.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import { Op } from "sequelize";
import Booking from "../model/booking.model.js";
import { UserService } from "../../user/service/user.service.js";
import bcrypt from "bcrypt";
import { razorpayInstance } from "../../../config/razorpay.js";
import { ADVANCE_PAYMENT_DEADLINE_HOURS } from "../../../constants/payment.constants.js";
import { BookingPricingService } from "./booking-pricing.service.js";
import { BookingCancellationService } from "./booking-cancellation.service.js";
import { BookingDocumentService } from "./booking-document.service.js";
import { BookingAvailabilityService } from "./booking-availability.service.js";

export class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.facilityService = new FacilityService();
    this.userService = new UserService();
    this.notificationService = new NotificationService();
    this.bookingPricingService = new BookingPricingService({
      bookingRepository: this.bookingRepository,
      facilityService: this.facilityService,
    });
    this.bookingCancellationService = new BookingCancellationService({
      bookingModel: Booking,
      razorpayInstance,
    });
    this.bookingDocumentService = new BookingDocumentService({
      bookingRepository: this.bookingRepository,
    });
    this.bookingAvailabilityService = new BookingAvailabilityService({
      bookingRepository: this.bookingRepository,
      facilityService: this.facilityService,
    });
  }

  async createBooking(userId, bookingData) {
    const { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails } =
      await this.bookingPricingService.processAndValidateBookingItems(
        bookingData,
      );

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
    // 1. Calculate the cutoff for the initial payment (e.g., 24 hours ago)
    const initialPaymentCutoff = new Date(
      Date.now() - ADVANCE_PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000,
    );

    // 2. Fetch both types of expired bookings
    const expiredInitialBookings =
      await this.bookingRepository.findExpiredInitialPayments(
        initialPaymentCutoff,
      );
    const expiredHoldBookings =
      await this.bookingRepository.findExpiredHoldBookings(new Date());

    // Combine them into one array to process
    const allExpiredBookings = [
      ...expiredInitialBookings,
      ...expiredHoldBookings,
    ];

    if (allExpiredBookings.length === 0) {
      console.log("🕒 No expired payments or holds found.");
      return;
    }

    // 3. Process cancellations
    for (const booking of allExpiredBookings) {
      try {
        const previousStatus = booking.status;

        booking.status = "CANCELLED";
        booking.cancelledAt = new Date();

        // Differentiate the reason based on what expired
        if (previousStatus === "PENDING_PAYMENT") {
          booking.cancellationReason = `Auto-cancelled: Initial payment not received within ${ADVANCE_PAYMENT_DEADLINE_HOURS} hours.`;
        } else if (previousStatus === "ON_HOLD") {
          // Format the deadline nicely for the reason string
          const deadlineStr = booking.holdDeadline
            ? booking.holdDeadline.toISOString().split("T")
            : "the deadline";
          booking.cancellationReason = `Auto-cancelled: Remaining 80% payment not received by ${deadlineStr}. 20% hold amount forfeited.`;
        }

        await booking.save();

        const user = booking.user;
        if (user && user.email) {
          console.log(
            `Auto-cancelled booking ${booking.id} for user ${user.email} (Reason: ${previousStatus})`,
          );
        }
      } catch (err) {
        console.error(`Failed to cancel booking ${booking.id}:`, err);
      }
    }

    console.log(`🕒 Processed ${allExpiredBookings.length} expired bookings.`);
  }

  async uploadAadhaarImages(
    bookingId,
    userId,
    frontFile,
    backFile,
    isAdmin = false,
  ) {
    return this.bookingDocumentService.uploadAadhaarImages(
      bookingId,
      userId,
      frontFile,
      backFile,
      isAdmin,
    );
  }

  /**
   * STAFF: Processes an offline/walk-in booking
   */
  async createBookingOnBehalf(bookingData, clerkId) {
    // 1. Find or Create the User based on mobile number
    let isNewUser = false;
    let user = await this.userService.findByMobile(bookingData.mobile);

    const plainTextPassword =
      "WalkInUser@" + Math.floor(1000 + Math.random() * 9000);
    const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

    if (!user) {
      user = await this.userService.createUser({
        fullName: bookingData.fullName,
        mobile: bookingData.mobile,
        email: bookingData.email || null,
        address: bookingData.address || null,
        passwordHash: hashedPassword,
        role: "USER",
      });
      isNewUser = true;
    }

    const { totalAmount, totalSecurityDeposit, mainFacilityId, customDetails } =
      await this.bookingPricingService.processAndValidateBookingItems(
        bookingData,
      );

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
      isHoldingAllowed: bookingData.isHoldingAllowed || false,
      holdingPercentage: bookingData.isHoldingAllowed
        ? bookingData.holdingPercentage
        : null,
      holdingValidityDays: bookingData.isHoldingAllowed
        ? bookingData.holdingValidityDays
        : null,
    });

    return { newBooking, user, isNewUser };
  }

  // Replace your existing getUnavailableDates method with this:
  async getUnavailableDates(facilityId) {
    return this.bookingAvailabilityService.getUnavailableDates(facilityId);
  }

  async checkAvailabilityAndPrice(bookingData) {
    try {
      if (bookingData.facilityId) {
        const facility = await this.facilityService.findById(
          bookingData.facilityId,
        );
        if (!facility) throw new AppError("Facility not found.", 404);

        const bookedQuantities =
          await this.bookingPricingService.getBookedQuantities(
            bookingData.startTime,
            bookingData.endTime,
          );

        const packageInclusions =
          facility.pricingDetails?.included_facilities || [];
        let takenComponents = [];
        let availableComponents = [];

        const allFacilities = await this.facilityService.findAll();

        for (const inc of packageInclusions) {
          const incName = inc.name || inc;
          const incQty = inc.quantity ? parseInt(inc.quantity, 10) : 1;

          const subFac = allFacilities.find((f) => f.name === incName);
          const subInventory = subFac ? subFac.inventoryCount || 1 : 1;
          const subAlreadyBooked = bookedQuantities[incName] || 0;

          if (subAlreadyBooked + incQty > subInventory) {
            takenComponents.push(incName);
          } else {
            availableComponents.push(incName);
          }
        }

        if (takenComponents.length > 0) {
          if (availableComponents.length === 0) {
            return {
              isAvailable: false,
              isPartiallyAvailable: false,
              message: `This package is completely booked for these dates. (${takenComponents.join(", ")} are all taken)`,
            };
          }

          const availableToBook = allFacilities
            .filter((f) => availableComponents.includes(f.name))
            .map((f) => ({
              facilityId: f.id,
              name: f.name,
              baseRate: f.baseRate,
              quantity: 1,
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

      const { totalAmount, totalSecurityDeposit } =
        await this.bookingPricingService.processAndValidateBookingItems(
          bookingData,
        );

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

        this.notificationService.sendBookingRejectionEmail(
          user.email,
          user.fullName,
          booking.id,
          hardcodedReason,
        );
      }
    } catch (emailError) {
      console.error("Failed to fetch user for rejection email:", emailError);
    }

    return booking;
  }

  // Update the method signature
  async checkInBooking(bookingId, checkInData) {
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

    if (checkInData && checkInData.securityDepositCollected) {
      booking.securityDepositStatus = "COLLECTED";
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
          association: "invoice",
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

      let revenueIn = 0;

      if (
        booking.paymentStatus === "COMPLETED" ||
        booking.status === "CONFIRMED" ||
        booking.status === "CHECKED_IN"
      ) {
        revenueIn =
          parseFloat(booking.calculatedAmount || 0) +
          parseFloat(booking.securityDeposit || 0);
      } else if (booking.status === "ON_HOLD") {
        revenueIn = parseFloat(booking.holdAmountPaid || 0);
      }

      const refunded = parseFloat(booking.refundAmount || 0);

      return sum + (revenueIn - refunded);
    }, 0);

    // 3. Format the response data to match the exact requirements
    const formattedBookings = bookings.map((booking) => {
      let currentPayment = 0;
      if (booking.invoice) {
        currentPayment = parseFloat(booking.invoice.totalAmount || 0);
      } else if (
        booking.paymentStatus === "COMPLETED" ||
        booking.status === "CONFIRMED"
      ) {
        currentPayment =
          parseFloat(booking.calculatedAmount || 0) +
          parseFloat(booking.securityDeposit || 0);
      } else if (booking.status === "ON_HOLD") {
        currentPayment = parseFloat(booking.holdAmountPaid || 0);
      }

      return {
        bookingId: booking.id,
        bookingDate: booking.createdAt,
        paymentAmount: currentPayment,
        status: booking.status,
      };
    });

    return {
      summary: {
        totalBookings,
        totalRevenue,
      },
      bookings: formattedBookings,
    };
  }

  async getCancellationPolicy() {
    return this.bookingCancellationService.getCancellationPolicy();
  }

  async requestCancellation(bookingId, userId, userRole, cancellationReason) {
    return this.bookingCancellationService.requestCancellation(
      bookingId,
      userId,
      userRole,
      cancellationReason,
    );
  }

  // 2. Admin Approves and Refunds
  async approveCancellationAndRefund(bookingId, adminId) {
    return this.bookingCancellationService.approveCancellationAndRefund(
      bookingId,
      adminId,
    );
  }

  async completeManualRefund(bookingId, staffId, refundNote) {
    return this.bookingCancellationService.completeManualRefund(
      bookingId,
      staffId,
      refundNote,
    );
  }
}
