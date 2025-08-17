// routes/userRoute.js
const express = require("express");
const { getUserDetails, updateUser,getAllUsers } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { validateUserUpdate } = require("../middleware/validators");
const multer = require("multer");

const router = express.Router();

// GET /api/user - fetches details for the logged-in user
router.get("/", protect, getUserDetails);

// Use multer memory storage so that file is available in req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// PATCH /api/user - update user profile with image upload
router.put("/", protect, validateUserUpdate, upload.single("profilePhoto"), updateUser);
router.get("/all", protect, getAllUsers);

module.exports = router;
