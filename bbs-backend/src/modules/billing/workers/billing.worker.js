import "../../../config/env.js";
import { Worker } from "bullmq";
import redisConnection from "../../../config/redis.js";
import { connectDatabase } from "../../../config/database.js";
import { BillingService } from "../service/billing.service.js";
import { BILLING_QUEUE_NAME } from "./billing.queue.js";

export const createBillingWorker = ({
  billingService,
  connection = redisConnection,
} = {}) => {
  if (!billingService) {
    throw new Error("billingService is required to create billing worker.");
  }

  return new Worker(
    BILLING_QUEUE_NAME,
    async (job) => {
      if (job.name === "generate-invoice-pdf") {
        const { invoiceId } = job.data;
        console.log(
          `🧾 Worker started: generating PDF for invoice ${invoiceId}`,
        );
        await billingService.generateAndUploadInvoicePdf(invoiceId);
        console.log(
          `🧾 Worker finished: PDF generated for invoice ${invoiceId}`,
        );
        return;
      }

      console.warn(`⚠️ Unknown billing job received: ${job.name}`);
    },
    {
      connection,
      concurrency: 1,
    },
  );
};

const startBillingWorker = async () => {
  await connectDatabase();

  const billingService = new BillingService();
  const worker = createBillingWorker({ billingService });

  worker.on("failed", (job, error) => {
    console.error(
      `❌ Billing worker failed for job ${job?.name || "unknown"}:`,
      error,
    );
  });

  worker.on("completed", (job) => {
    console.log(`✅ Billing worker completed job: ${job.name}`);
  });

  let isShuttingDown = false;

  const shutdown = async (signal = "unknown") => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`🛑 Shutting down billing worker (${signal})...`);

    try {
      await worker.close();
    } catch (error) {
      console.error("❌ Error while closing billing worker:", error);
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

  console.log("🚀 Billing worker started and waiting for jobs...");
};

startBillingWorker().catch((error) => {
  console.error("❌ Failed to start billing worker:", error);
  process.exit(1);
});
