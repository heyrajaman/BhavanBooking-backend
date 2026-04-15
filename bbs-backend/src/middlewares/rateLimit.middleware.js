import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisConnection from "../config/redis.js";

const createLimiter = ({
  windowMinutes,
  max,
  message,
  prefix,
  skipSuccessfulRequests,
}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    message: {
      status: "fail",
      message,
    },
    store: new RedisStore({
      sendCommand: (...args) => redisConnection.call(...args),
      prefix,
    }),
  });

export const globalLimiter = createLimiter({
  windowMinutes: 15,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  prefix: "rl:global:",
});

export const strictAuthLimiter = createLimiter({
  windowMinutes: 15,
  max: 5,
  message: "Too many failed authentication attempts, please try again later.",
  prefix: "rl:auth:",
  skipSuccessfulRequests: true,
});

export const paymentOrderLimiter = createLimiter({
  windowMinutes: 15,
  max: 20,
  message: "Too many payment initialization requests, please try again later.",
  prefix: "rl:payment:",
});

export const bookingCreateLimiter = createLimiter({
  windowMinutes: 15,
  max: 10,
  message: "Too many booking attempts, please try again later.",
  prefix: "rl:booking:",
});
