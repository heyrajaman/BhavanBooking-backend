// src/app.js

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Import your domain routes
import bookingRoutes from "./modules/booking/routes/booking.routes.js";
import authRoutes from "./modules/user/routes/auth.routes.js";
import facilityRoutes from "./modules/facility/routes/facility.routes.js";
import billingRoutes from "./modules/billing/routes/billing.routes.js";
import adminAuthRoutes from "./modules/admin/routes/admin.auth.routes.js";

// Import the error handler and custom error class
import { globalErrorHandler } from "./middlewares/error.middleware.js";
import { AppError } from "./utils/AppError.js";

const app = express();

// 1. Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads
app.use(morgan("dev")); // Logs API requests to the terminal

// 2. Mount your Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth/admin", adminAuthRoutes);
app.use("/api/v1/facilities", facilityRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/billing", billingRoutes);
// app.use('/api/v1/users', userRoutes);

// 3. Handle unhandled routes (404)
app.use((req, res, next) => {
  // If the code reaches here, it means no router caught the request
  // We throw our custom AppError, and pass it to next()
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

// 4. Global Error Handling Middleware (MUST BE LAST)
app.use(globalErrorHandler);

export default app;
