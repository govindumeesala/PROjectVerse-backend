// src/controllers/commentController.js
const Comment = require("../models/Comment");
const Project = require("../models/Project");
const {StatusCodes} = require("http-status-codes");

// Add comment
exports.addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) return res.error("Project not found", StatusCodes.NOT_FOUND);

    const comment = await Comment.create({
      project: projectId,
      user: req.user._id || req.user.userId,
      content,
    });

    await comment.populate("user", "name profilePhoto");

    return res.success(StatusCodes.OK, "Comment added successfully", comment);
  } catch (err) {
    next(err);
  }
};

// Get comments for project
exports.getCommentsByProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    const comments = await Comment.find({ project: projectId })
      .populate("user", "name profilePhoto")
      .sort({ createdAt: -1 });

    return res.success(StatusCodes.OK, "Comments retrieved successfully", comments);
  } catch (err) {
    next(err);
  }
};
