const express = require("express");
const router = express.Router();
const { createProject, getMyProjects, getProjectById, getContributedProjects } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
const  pagination = require("../middleware/pagination");
const multer = require("multer");

// Use memory storage so the file is available as req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/project/create - Create a new project
router.post("/create", protect, upload.single("projectPhoto"), createProject);

// GET /api/projects/my-projects
router.get("/my-projects", protect, pagination(), getMyProjects);

// GET /api/projects/contributed
router.get("/contributed", protect, pagination(), getContributedProjects);

// routes/projectRoutes.js
router.get("/:id", protect, getProjectById);

module.exports = router;
