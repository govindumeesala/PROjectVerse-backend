// routes/userRoute.js
const express = require("express");
const userController = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { validateUserUpdate } = require("../middleware/validators");
const pagination = require("../middleware/pagination");
const multer = require("multer");

const router = express.Router();

// GET /api/user - fetches details for the logged-in user
router.get("/", protect, userController.getUserDetails);

// Use multer memory storage so that file is available in req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// PATCH /api/user - update user profile with image upload
router.put("/", protect, validateUserUpdate, upload.single("profilePhoto"), userController.updateUser);

// GET /api/user/all - fetches all users
router.get("/all", protect, userController.getAllUsers);

// GET /api/user/stats - new stats endpoint
router.get("/stats", protect, userController.getMyStats);

// GET bookmarked projects
router.get("/bookmarks", protect, pagination(), userController.getBookmarks);

// PUT toggle bookmark
router.put("/bookmarks/:projectId", protect, userController.toggleBookmark);

module.exports = router;
