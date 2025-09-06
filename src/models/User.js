const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: {
    type: String,
    enum: ["student", "faculty"],
    default: "student",
    required: true,
  },
  year: { type: String, required: false }, // e.g., graduation or current academic year
  idNumber: { type: String, required: false }, // student or faculty id
  profilePhoto: { type: String, required: false }, // URL to profile photo
  summary: { type: String, required: false }, // short bio or summary
  googleId: { type: String, required: false },
  authProvider: { type: String, enum: ["google", "local"], default: "local" },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
  createdAt: { type: Date, default: Date.now },
  socials: {
    github: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    instagram: { type: String, default: "" },
    // Add more as needed, e.g.:
    // twitter: { type: String, default: "" },
    // website: { type: String, default: "" },
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and hyphen.'],
  },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
