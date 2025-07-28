const express = require("express");
const router = express.Router();
const { createProject } = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");

// Use memory storage so the file is available as req.file.buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// POST /api/project/create - Create a new project
router.post("/create", protect, upload.single("projectPhoto"), createProject);

module.exports = router;
