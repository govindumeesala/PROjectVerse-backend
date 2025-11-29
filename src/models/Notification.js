const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true, // Index for faster queries
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  type: {
    type: String,
    enum: [
      "collab_request_received",
      "collab_request_approved",
      "collab_request_rejected",
      "project_liked",
      "project_commented",
      "project_bookmarked",
      "system",
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String },
  link: { type: String }, // redirect path on click (e.g., /username/slug)
  meta: { type: mongoose.Schema.Types.Mixed }, // extra structured metadata (projectId, slug, etc.)
  read: { type: Boolean, default: false, index: true }, // Index for unread queries
  createdAt: { type: Date, default: Date.now, index: true }, // Index for sorting
});

// Compound index for efficient queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
