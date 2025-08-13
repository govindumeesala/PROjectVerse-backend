const mongoose = require("mongoose");

const collaborationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String }, // role in the collaboration
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null }, // optional if collaboration ends
  contributionSummary: { type: String }, // short note
  request: { type: mongoose.Schema.Types.ObjectId, ref: "ProjectRequest" }, // optional link back to the request
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

collaborationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Collaboration", collaborationSchema);
