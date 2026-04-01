// src/modules/booking/workers/booking.cron.js
import { Queue } from "bullmq";
import redisConnection from "../../../config/redis.js";

const bookingQueue = new Queue("booking-jobs", {
  connection: redisConnection,
});

export const initBookingCronJobs = async () => {
  await bookingQueue.add(
    "process-expired-payments",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "process-expired-payments-hourly",
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );

  console.log("🕒 Booking queue scheduler initialized (hourly repeat job).");
};
