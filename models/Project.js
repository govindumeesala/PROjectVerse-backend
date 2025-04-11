const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  domain: { type: String, required: true }, // e.g., Web Dev, AI, etc.
  techStack: [{ type: String, required: true }], // e.g., ["React", "Node.js", "MongoDB"]
  projectPhoto: { type: String, required: false }, // URL to project image
  githubURL: { type: String, required: false },
  deploymentURL: { type: String, required: false },
  status: { type: String, enum: ["completed", "looking for collaborators"], default: "looking for collaborators" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Project owner
  contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Contributors
  requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserRequest", default: [] }], // User requests to join
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Project", projectSchema);
