const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional - who triggered it
  type: {
    type: String,
    enum: ["request_received", "request_approved", "request_rejected", "project_deleted", "message"],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String },
  link: { type: String }, // optional URL to project or request
  read: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed }, // extra structured metadata
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notification", notificationSchema);
