// src/controllers/notificationController.js
// Controller for notification management endpoints
const Notification = require("../models/Notification");
const { StatusCodes } = require("http-status-codes");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");

/**
 * GET /api/notifications
 * Get all notifications for the logged-in user
 * Supports pagination and filtering
 */
exports.getNotifications = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20, unreadOnly = false } = req.query;

  // Build query
  const query = { recipient: userId };
  if (unreadOnly === "true") {
    query.read = false;
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const limitNum = parseInt(limit);

  // Fetch notifications with pagination
  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .populate("sender", "username name profilePhoto")
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limitNum)
      .lean(), // Use lean() for better performance
    Notification.countDocuments(query),
  ]);

  // Format response
  const formattedNotifications = notifications.map((notif) => ({
    _id: notif._id,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    link: notif.link,
    meta: notif.meta,
    read: notif.read,
    createdAt: notif.createdAt,
    sender: notif.sender
      ? {
          _id: notif.sender._id,
          username: notif.sender.username,
          name: notif.sender.name,
          profilePhoto: notif.sender.profilePhoto,
        }
      : null,
  }));

  return res.success(StatusCodes.OK, "Notifications retrieved successfully", {
    notifications: formattedNotifications,
    pagination: {
      page: parseInt(page),
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
exports.getUnreadCount = catchAsync(async (req, res) => {
  const userId = req.user.userId;

  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    read: false,
  });

  return res.success(StatusCodes.OK, "Unread count retrieved", {
    unreadCount,
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
exports.markAsRead = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid notification ID", StatusCodes.BAD_REQUEST);
  }

  // Find and update notification
  const notification = await Notification.findOneAndUpdate(
    {
      _id: id,
      recipient: userId, // Ensure user owns this notification
    },
    { read: true },
    { new: true }
  );

  if (!notification) {
    throw new AppError("Notification not found", StatusCodes.NOT_FOUND);
  }

  return res.success(StatusCodes.OK, "Notification marked as read", {
    notification: {
      _id: notification._id,
      read: notification.read,
    },
  });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the logged-in user
 */
exports.markAllAsRead = catchAsync(async (req, res) => {
  const userId = req.user.userId;

  const result = await Notification.updateMany(
    {
      recipient: userId,
      read: false,
    },
    { read: true }
  );

  return res.success(StatusCodes.OK, "All notifications marked as read", {
    updatedCount: result.modifiedCount,
  });
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
exports.deleteNotification = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid notification ID", StatusCodes.BAD_REQUEST);
  }

  const notification = await Notification.findOneAndDelete({
    _id: id,
    recipient: userId, // Ensure user owns this notification
  });

  if (!notification) {
    throw new AppError("Notification not found", StatusCodes.NOT_FOUND);
  }

  return res.success(StatusCodes.OK, "Notification deleted successfully");
});

/**
 * DELETE /api/notifications/delete-all
 * Delete all notifications for the logged-in user
 */
exports.deleteAllNotifications = catchAsync(async (req, res) => {
  const userId = req.user.userId;

  const result = await Notification.deleteMany({
    recipient: userId,
  });

  return res.success(StatusCodes.OK, "All notifications deleted", {
    deletedCount: result.deletedCount,
  });
});

