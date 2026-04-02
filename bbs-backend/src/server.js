import http from "http";
import "./config/env.js";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { initMinio } from "./config/minio.js";
import {
  createBookingQueue,
  initBookingCronJobs,
} from "./modules/booking/workers/booking.cron.js";
import { initSocket } from "./config/socket.js";

const PORT = process.env.PORT;

const httpServer = http.createServer(app);

initSocket(httpServer);

// Catch synchronous errors that happen outside of Express (e.g., syntax errors)
process.on("uncaughtException", (err) => {
  console.error("🚨 UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

const startServer = async () => {
  // 1. Connect to MySQL Database
  await connectDatabase();

  await initMinio();

  // 2. Initialize Background Workers (like the 7-day hold cancellation)
  const bookingQueue = createBookingQueue();
  await initBookingCronJobs(bookingQueue);

  // 3. Start listening for incoming HTTP requests
  const server = httpServer.listen(PORT, () => {
    console.log(
      `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
    );
  });

  // Catch asynchronous errors outside of Express (e.g., unhandled promise rejections)
  process.on("unhandledRejection", (err) => {
    console.error("🚨 UNHANDLED REJECTION! Shutting down gracefully...");
    console.error(err.name, err.message);

    // Close the server properly before exiting
    server.close(() => {
      process.exit(1);
    });
  });
};

// Ignite the engine
startServer();
