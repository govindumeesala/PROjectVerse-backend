const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoute");
const projectRoutes = require("./src/routes/projectRoute");
const {successHandler, errorHandler} = require("./src/middleware/apiResponseMiddleware");

const app = express();
app.use(express.json());
app.use(cors());
app.use(successHandler);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/project", projectRoutes)

// Place error handler after all routes
app.use(errorHandler);

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
