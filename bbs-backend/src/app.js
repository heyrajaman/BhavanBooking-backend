// src/app.js

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import v1Routes from "./routes/v1/index.js";

// Import the error handler and custom error class
import { globalErrorHandler } from "./middlewares/error.middleware.js";
import { AppError } from "./utils/AppError.js";

const app = express();

// 1. Global Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json()); // Parses incoming JSON payloads
app.use(cookieParser());
app.use(morgan("dev")); // Logs API requests to the terminal

// 2. Mount your Routes
app.use("/api/v1", v1Routes);

// 3. Handle unhandled routes (404)
app.use((req, res, next) => {
  // If the code reaches here, it means no router caught the request
  // We throw our custom AppError, and pass it to next()
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

// 4. Global Error Handling Middleware (MUST BE LAST)
app.use(globalErrorHandler);

export default app;
