// src/socket.js
// WebSocket configuration with Socket.IO for real-time notifications
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} - Socket.IO server instance
 */
const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
    // Enable auto-reconnection
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      // Try to get token from handshake auth (preferred)
      let token = socket.handshake.auth?.token;
      
      // Fallback to query parameter if auth token not provided
      if (!token) {
        token = socket.handshake.query?.token;
      }

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Remove 'Bearer ' prefix if present
      token = token.replace(/^Bearer\s+/, "");

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      
      // Verify user exists
      const user = await User.findById(decoded.userId).select("_id username");
      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.user = user;
      
      next();
    } catch (err) {
      console.error("Socket authentication error:", err.message);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    const userId = socket.userId;
    const userRoom = `user:${userId}`;

    console.log(`✅ User ${userId} connected to Socket.IO`);

    // Join user-specific room for targeted notifications
    socket.join(userRoom);

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected: ${reason}`);
    });

    // Handle reconnection
    socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 User ${userId} reconnected after ${attemptNumber} attempts`);
      socket.join(userRoom);
    });

    // Optional: Handle custom events from client
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });
  });

  console.log("🚀 Socket.IO server initialized");
  return io;
};

/**
 * Emit event to a specific user
 * @param {string} userId - User ID to send notification to
 * @param {string} eventName - Event name (e.g., 'notification')
 * @param {Object} payload - Data to send
 * @returns {boolean} - True if user is online and notification sent, false otherwise
 */
const emitToUser = (userId, eventName, payload) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Notification saved to DB but not sent in real-time.");
    return false;
  }

  try {
    const userRoom = `user:${userId}`;
    io.to(userRoom).emit(eventName, payload);
    console.log(`📤 Notification sent to user ${userId} via Socket.IO`);
    return true;
  } catch (error) {
    console.error("❌ Error emitting to user:", error);
    return false;
  }
};

/**
 * Get Socket.IO instance (for use in other modules)
 * @returns {Server|null} - Socket.IO server instance
 */
const getIO = () => {
  return io;
};

module.exports = {
  initializeSocket,
  emitToUser,
  getIO,
};

