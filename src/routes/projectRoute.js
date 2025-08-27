const express = require("express");
const router = express.Router();
const { createProject,getMyProjects,getProjectById } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");
const {
  getProjectFeed,
  likeProject,
  unlikeProject,
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

// GET /api/projects/my-projects
router.get("/my-projects", protect, getMyProjects);

// FEED
router.get("/feed", protect, getProjectFeed);

// routes/projectRoutes.js
router.get("/:id", protect, getProjectById);

// LIKE
router.post("/:id/like", protect, likeProject);
router.post("/:id/unlike", protect, unlikeProject);

// // SHARE → Just reuse getProjectById
// router.get("/:id", protect, getProjectById);

// COMMENTS
router.post("/:id/comments", protect, addComment);
router.get("/:id/comments", protect, getCommentsByProject);


module.exports = router;
