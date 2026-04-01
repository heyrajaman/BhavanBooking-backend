import "../../../config/env.js";
import { Worker } from "bullmq";
import redisConnection from "../../../config/redis.js";
import { BookingService } from "../service/booking.service.js";

const bookingService = new BookingService();

const worker = new Worker(
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
    connection: redisConnection,
    concurrency: 1,
  },
);

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

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("🛑 Shutting down booking worker...");
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

console.log("🚀 Booking worker started and waiting for jobs...");
