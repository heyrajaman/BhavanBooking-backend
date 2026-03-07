import { BookingRepository } from "../repository/booking.repository.js";
import { NotificationService } from "../../notification/service/notification.service.js";
import { FacilityRepository } from "../../facility/repository/facility.repository.js";
import crypto from "crypto";
import { AppError } from "../../../utils/AppError.js";

export class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.notificationService = new NotificationService();
    this.facilityRepository = new FacilityRepository();
  }

  /**
   * Processes a new provisional booking application.
   * @param {CreateBookingRequestDto} dto - The validated data from the user
   */
  async createProvisionalBooking(dto) {
    // 1. Enforce Business Rules on Dates [cite: 77, 144]
    // The system forces Check-in at 10:00 AM and Check-out at 08:00 AM next day.
    const startDate = new Date(dto.startDate);
    startDate.setHours(10, 0, 0, 0);

    const endDate = new Date(dto.endDate);
    endDate.setDate(endDate.getDate() + 1); // Next day
    endDate.setHours(8, 0, 0, 0);

    // 2. Check Availability
    const isOverlapping = await this.bookingRepository.checkFacilityOverlap(
      dto.facilityIds,
      startDate,
      endDate,
    );

    if (isOverlapping) {
      // Use AppError with a 400 status code so the frontend knows it's a user error, not a server crash!
      throw new AppError(
        "Facility is not available for the selected dates. Please choose another date.",
        400,
      );
    }

    // --- DYNAMIC MATH LOGIC ---
    // A. Calculate the total number of days booked
    const timeDifference = endDate.getTime() - startDate.getTime();
    const numberOfDays = Math.ceil(timeDifference / (1000 * 3600 * 24));

    // B. Fetch the facilities from the database to get their prices
    const facilities = await this.facilityRepository.findByIds(dto.facilityIds);
    if (facilities.length === 0) {
      throw new AppError(
        "The selected facilities could not be found in the database.",
        404,
      );
    }

    // C. Sum up the daily rates of all selected facilities
    let totalDailyRate = 0;
    for (const facility of facilities) {
      totalDailyRate += parseFloat(facility.baseRatePerDay);
    }

    // D. Calculate total cost and the 20% advance FRS Rule
    const totalCost = totalDailyRate * numberOfDays;
    const calculatedAdvanceAmount = totalCost * 0.2;

    // Log this so you can verify the math in your terminal!
    console.log(
      `[Billing Math] Total Days: ${numberOfDays}, Total Cost: ₹${totalCost}, 20% Advance: ₹${calculatedAdvanceAmount}`,
    );
    // ------------------------------

    // 3. Prepare the Booking Record
    // Generate a unique reference like "BBS-20260306-XYZ"
    const bookingRef = `BBS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    const newBookingData = {
      bookingReference: bookingRef,
      userId: dto.userId,
      eventType: dto.eventType,
      startDatetime: startDate,
      endDatetime: endDate,
      status: "HOLD", // Placed on a 7-day temporary hold [cite: 83, 144]
      guestCount: dto.guestCount,
      isVegetarianOnly: dto.isVegetarianOnly,
      isDjProhibited: dto.isDjProhibited,
    };

    // 4. Save to Database
    const savedBooking =
      await this.bookingRepository.createBooking(newBookingData);

    this.notificationService
      .sendProvisionalHoldEmail(
        dto.email,
        dto.fullName,
        savedBooking.bookingReference,
        calculatedAdvanceAmount,
      )
      .catch((err) => console.error("Background email failed", err));

    // Note: We would normally call the Billing Service here to calculate the 20% advance
    // and generate an invoice, but we are keeping boundaries strict!

    return savedBooking;
  }

  /**
   * Background job method to cancel expired 7-day holds.
   */
  async processExpiredHolds() {
    console.log("[BookingService] Starting expired holds processing...");

    // Calculate the exact time 7 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // 1. Find all expired bookings
    const expiredBookings =
      await this.bookingRepository.findExpiredHolds(cutoffDate);

    if (expiredBookings.length === 0) {
      console.log("[BookingService] No expired holds found.");
      return;
    }

    // 2. Extract their IDs
    const bookingIds = expiredBookings.map((booking) => booking.id);

    // 3. Update their status to CANCELLED in the database
    await this.bookingRepository.cancelBookings(bookingIds);

    // 4. (Optional but recommended) Notify the users
    // for (const booking of expiredBookings) {
    //   await this.notificationService.sendCancellationEmail(booking.userId, booking.bookingReference);
    // }

    console.log(
      `[BookingService] Successfully cancelled ${expiredBookings.length} expired holds.`,
    );
  }
}
