const express = require("express");
const router = express.Router();
const { createProject, getUserProjects, getProjectById, getContributedProjects,getProjectPage, requestToJoin, updateProject, respondToRequest } = require("../controllers/projectController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const  pagination = require("../middleware/pagination");
const multer = require("multer");
const {
  getProjectFeed,
  likeProject,
  unlikeProject,
  checkTitle,
} = require("../controllers/projectController");

const {
  addComment,
  getCommentsByProject,
} = require("../controllers/commentController");

// Use memory storage so the file is available as req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/project/create - Create a new project
router.post("/create", protect, upload.single("projectPhoto"), createProject);
router.post("/check-title", protect, checkTitle);

// GET /api/projects/user-projects - profile
router.get("/user-projects/:username", optionalAuth, pagination(), getUserProjects);

// GET /api/projects/contributed - profile
router.get("/contributed/:username", optionalAuth, pagination(), getContributedProjects);

// FEED
router.get("/feed", protect, getProjectFeed);

// Public route - anyone can view (place BEFORE generic :id routes)
router.get("/:username/:slug", optionalAuth, getProjectPage);

// routes using :id below
router.get("/:id", protect, getProjectById);

// LIKE
router.put("/:id/like", protect, likeProject);
router.put("/:id/unlike", protect, unlikeProject);

// COMMENTS
router.post("/:id/comments", protect, addComment);
router.get("/:id/comments", protect, getCommentsByProject);

// Auth required - request to join
router.post("/:username/:slug/join", protect, requestToJoin);

// Auth required & must be owner - update
router.put("/:username/:slug", protect, updateProject);

// Auth required & must be owner - respond to join request
router.patch("/:username/:slug/respond-to-request/:requestId", protect, respondToRequest);

module.exports = router;
