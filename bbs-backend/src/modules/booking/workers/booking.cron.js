// src/modules/booking/workers/booking.cron.js
import cron from "node-cron";
import { BookingService } from "../service/booking.service.js";

const bookingService = new BookingService();

export const initBookingCronJobs = () => {
  // Runs every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🕒 Cron check started: Looking for expired payments...");
      await bookingService.processExpiredPayments();
      console.log("🕒 Cron check finished.");
    } catch (error) {
      console.error("[CRON ERROR] Failed to process expired payments:", error);
    }
  });

  console.log("🕒 Booking cron jobs initialized.");
};
