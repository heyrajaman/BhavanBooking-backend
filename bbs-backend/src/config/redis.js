import IORedis from "ioredis";

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redisConnection.on("error", (error) => {
  console.error("❌ Redis connection error:", error.message);
});

redisConnection.on("connect", () => {
  console.log("🧠 Redis connected.");
});

export default redisConnection;
