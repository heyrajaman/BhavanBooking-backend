import cron from "node-cron";
import { BookingService } from "../service/booking.service.js";

const bookingService = new BookingService();

/**
 * Initializes all background jobs for the booking module.
 * This should be called once in your main server.js file.
 */
export const initBookingCronJobs = () => {
  // Run this task every hour at minute 0 (e.g., 1:00, 2:00, 3:00)
  cron.schedule("0 * * * *", async () => {
    try {
      await bookingService.processExpiredHolds();
    } catch (error) {
      console.error("[CRON ERROR] Failed to process expired holds:", error);
      // In a real system, you might send an alert to your Slack/Discord here
    }
  });

  console.log("🕒 Booking cron jobs initialized.");
};
