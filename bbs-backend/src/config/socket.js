// src/config/socket.js

import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

let io;

export const initSocket = (httpServer) => {
  // Initialize Socket.io with CORS settings matching your Express app
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  // Socket.io's Redis adapter requires two separate Redis clients:
  // one for publishing events and one for subscribing.
  const pubClient = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
  });

  const subClient = pubClient.duplicate();

  // Attach the Redis adapter
  io.adapter(createAdapter(pubClient, subClient));

  // Basic connection handling
  io.on("connection", (socket) => {
    console.log(`🔌 New client connected via Socket: ${socket.id}`);

    // Allow clients (like your React app) to join specific rooms
    // (e.g., "admin-notifications" or a specific "userId")
    socket.on("join_room", (room) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Export a getter function so we can use `io` in our controllers/services later
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};
