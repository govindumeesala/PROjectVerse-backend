// routes/userRoute.js
const express = require("express");
const userController = require("../controllers/userController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { validateUserUpdate } = require("../middleware/validators");
const pagination = require("../middleware/pagination");
const multer = require("multer");

const router = express.Router();

// GET /api/user - fetches details for the logged-in user
router.get("/", protect, userController.getUserDetails);

// GET /api/user/all - fetches all users
router.get("/all", protect, userController.getAllUsers);

// get user details by username public route
router.get("/:username", optionalAuth, userController.getUserDetailsByUsername);

// Use multer memory storage so that file is available in req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// PATCH /api/user - update user profile with image upload
router.put("/", protect, validateUserUpdate, upload.single("profilePhoto"), userController.updateUser);

// GET /api/user/stats - profile
router.get("/stats/:username", optionalAuth, userController.getUserStats);

// GET bookmarked projects - profile
router.get("/bookmarks/:username", optionalAuth, pagination(), userController.getBookmarks);

// PUT toggle bookmark
router.put("/bookmarks/:projectId", protect, userController.toggleBookmark);

module.exports = router;
