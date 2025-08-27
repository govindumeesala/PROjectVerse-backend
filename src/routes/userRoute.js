// routes/userRoute.js
const express = require("express");
const userService = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { validateUserUpdate } = require("../middleware/validators");
const pagination = require("../middleware/pagination");
const multer = require("multer");

const router = express.Router();

// GET /api/user - fetches details for the logged-in user
router.get("/", protect, userService.getUserDetails);

// Use multer memory storage so that file is available in req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// PATCH /api/user - update user profile with image upload
router.put("/", protect, validateUserUpdate, upload.single("profilePhoto"), userService.updateUser);

// GET /api/user/all - fetches all users
router.get("/all", protect, userService.getAllUsers);

// GET /api/user/stats - new stats endpoint
router.get("/stats", protect, userService.getMyStats);

// GET bookmarked projects
router.get("/bookmarks", protect, pagination(), userService.getBookmarks);

module.exports = router;
