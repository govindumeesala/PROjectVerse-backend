const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  domain: { type: String, required: true }, // e.g., Web Dev, AI, etc.
  techStack: [{ type: String, required: true }], // e.g., ["React", "Node.js", "MongoDB"]
  projectPhoto: { type: String, required: false }, // URL to project image
  githubURL: { type: String, required: false },
  deploymentURL: { type: String, required: false },
  demoURL : {type:String,required:false},
  status: { type: String, enum: ["completed", "ongoing"], default: "ongoing" },
  lookingForContributors: { type: Boolean, default: false }, // Whether the project is looking for contributors
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Project owner
  // contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Contributors
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Project", projectSchema);
