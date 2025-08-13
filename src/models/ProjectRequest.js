const mongoose = require("mongoose");

const projectRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String }, // optional message from requester
  roleRequested: { type: String }, // e.g., 'frontend', 'backend', 'ML'
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "cancelled"],
    default: "pending",
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who approved/rejected
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// keep updatedAt current
projectRequestSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ProjectRequest", projectRequestSchema);
