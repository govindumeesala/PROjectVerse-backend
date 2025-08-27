const express = require("express");
const router = express.Router();
const bookmarkController = require("../controllers/bookmarkController");
const { protect } = require("../middleware/authMiddleware"); // Assuming JWT middleware
const { successHandler } = require("../middleware/apiResponseMiddleware");

// Success middleware
router.use(successHandler);

// Protected routes
router.get("/", protect, bookmarkController.getBookmarks);
router.post("/:projectId", protect, bookmarkController.bookmarkProject);
router.delete("/:projectId", protect, bookmarkController.unBookmarkProject);

module.exports = router;
