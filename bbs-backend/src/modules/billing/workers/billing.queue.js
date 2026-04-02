import { Queue } from "bullmq";
import redisConnection from "../../../config/redis.js";

export const BILLING_QUEUE_NAME = "billing-jobs";

export const createBillingQueue = (connection = redisConnection) => {
  return new Queue(BILLING_QUEUE_NAME, {
    connection,
  });
};

let defaultBillingQueue;
const getDefaultBillingQueue = () => {
  if (!defaultBillingQueue) {
    defaultBillingQueue = createBillingQueue();
  }

  return defaultBillingQueue;
};

export const enqueueInvoicePdfGeneration = async (
  invoiceId,
  billingQueue = getDefaultBillingQueue(),
) => {
  return billingQueue.add(
    "generate-invoice-pdf",
    { invoiceId },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
      jobId: `generate-invoice-pdf-${invoiceId}`,
    },
  );
};
