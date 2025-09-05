const express = require("express");
const router = express.Router();
const { createProject, getMyProjects, getProjectById, getContributedProjects,getProjectPage, requestToJoin, updateProject } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
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

// GET /api/projects/my-projects
router.get("/my-projects", protect, pagination(), getMyProjects);

// GET /api/projects/contributed
router.get("/contributed", protect, pagination(), getContributedProjects);

// FEED
router.get("/feed", protect, getProjectFeed);

// routes/projectRoutes.js
router.get("/:id", protect, getProjectById);

// LIKE
router.put("/:id/like", protect, likeProject);
router.put("/:id/unlike", protect, unlikeProject);

// // SHARE → Just reuse getProjectById
// router.get("/:id", protect, getProjectById);

// COMMENTS
router.post("/:id/comments", protect, addComment);
router.get("/:id/comments", protect, getCommentsByProject);

// Public route - anyone can view
router.get("/:username/:projectTitle", getProjectPage);

// Auth required - request to join
router.post("/:username/:projectTitle/join", protect, requestToJoin);

// Auth required & must be owner - update
router.put("/:username/:projectTitle", protect, updateProject);

module.exports = router;
