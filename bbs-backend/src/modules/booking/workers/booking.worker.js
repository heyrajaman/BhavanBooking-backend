import "../../../config/env.js";
import { Worker } from "bullmq";
import redisConnection from "../../../config/redis.js";
import { connectDatabase } from "../../../config/database.js";
import { BookingService } from "../service/booking.service.js";

export const createBookingWorker = ({
  bookingService,
  connection = redisConnection,
} = {}) => {
  if (!bookingService) {
    throw new Error("bookingService is required to create booking worker.");
  }

  return new Worker(
    "booking-jobs",
    async (job) => {
      if (job.name === "process-expired-payments") {
        console.log("🕒 Worker started: processing expired payments...");
        await bookingService.processExpiredPayments();
        console.log("🕒 Worker finished: expired payments processed.");
        return;
      }

      console.warn(`⚠️ Unknown booking job received: ${job.name}`);
    },
    {
      connection,
      concurrency: 1,
    },
  );
};

const startBookingWorker = async () => {
  await connectDatabase();

  const bookingService = new BookingService();
  const worker = createBookingWorker({ bookingService });

  worker.on("failed", (job, error) => {
    console.error(
      `❌ Booking worker failed for job ${job?.name || "unknown"}:`,
      error,
    );
  });

  worker.on("completed", (job) => {
    console.log(`✅ Booking worker completed job: ${job.name}`);
  });

  let isShuttingDown = false;

  const shutdown = async (signal = "unknown") => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`🛑 Shutting down booking worker (${signal})...`);

    try {
      await worker.close();
    } catch (error) {
      console.error("❌ Error while closing booking worker:", error);
    }

    try {
      await redisConnection.quit();
    } catch (error) {
      console.error("❌ Error while closing Redis connection:", error);
    }

    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  console.log("🚀 Booking worker started and waiting for jobs...");
};

startBookingWorker().catch((error) => {
  console.error("❌ Failed to start booking worker:", error);
  process.exit(1);
});
