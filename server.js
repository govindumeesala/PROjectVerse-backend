const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoute");
const projectRoutes = require("./src/routes/projectRoute");
const notificationRoutes = require("./src/routes/notificationRoute");
const {successHandler, errorHandler} = require("./src/middleware/apiResponseMiddleware");
const { initializeSocket } = require("./src/socket");

const allowedOrigins = ["http://localhost:5173"]; // adjust to your frontend origin

const app = express();
app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // IMPORTANT: allow cookies
}));
app.use(cookieParser());
app.use(successHandler);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/notifications", notificationRoutes);

// Place error handler after all routes
app.use(errorHandler);

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    // Create HTTP server (required for Socket.IO)
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    initializeSocket(server);
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 Socket.IO server initialized`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
