// src/routes/notificationRoute.js
// Routes for notification management
const express = require("express");
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

// All notification routes require authentication
router.use(protect);

// GET /api/notifications - Get all notifications (with pagination)
router.get("/", getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", getUnreadCount);

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch("/:id/read", markAsRead);

// PATCH /api/notifications/read-all - Mark all as read
router.patch("/read-all", markAllAsRead);

// DELETE /api/notifications/:id - Delete single notification
router.delete("/:id", deleteNotification);

// DELETE /api/notifications/delete-all - Delete all notifications
router.delete("/delete-all", deleteAllNotifications);

module.exports = router;

