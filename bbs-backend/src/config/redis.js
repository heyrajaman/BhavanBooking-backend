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

export const cacheTtl = {
  facilitiesDefaultSeconds: Number(
    process.env.CACHE_TTL_FACILITIES_DEFAULT || 600,
  ),
  facilitiesAvailabilitySeconds: Number(
    process.env.CACHE_TTL_FACILITIES_AVAILABILITY || 60,
  ),
};

export const getJsonCache = async (key) => {
  const cachedValue = await redisConnection.get(key);
  if (!cachedValue) return null;

  try {
    return JSON.parse(cachedValue);
  } catch (error) {
    // If bad payload was ever written, remove it to avoid repeated parse failures.
    await redisConnection.del(key);
    return null;
  }
};

export const setJsonCache = async (key, value, ttlSeconds) => {
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redisConnection.set(key, payload, "EX", ttlSeconds);
    return;
  }

  await redisConnection.set(key, payload);
};

export const deleteKeysByPattern = async (pattern) => {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redisConnection.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "100",
    );

    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }

    cursor = nextCursor;
  } while (cursor !== "0");
};

export default redisConnection;
