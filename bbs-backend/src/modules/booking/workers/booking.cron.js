// src/modules/booking/workers/booking.cron.js
import cron from "node-cron";
import { BookingService } from "../service/booking.service.js";

const bookingService = new BookingService();

export const initBookingCronJobs = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      // Temporarily disabled until we implement the new Razorpay payment expiration flow
      // await bookingService.processExpiredPayments();
      console.log("🕒 Cron check ran: Payment expirations currently disabled.");
    } catch (error) {
      console.error("[CRON ERROR] Failed to process:", error);
    }
  });

  console.log("🕒 Booking cron jobs initialized.");
};
