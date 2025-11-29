// src/controllers/commentController.js
const Comment = require("../models/Comment");
const Project = require("../models/Project");
const mongoose = require("mongoose");
const {StatusCodes} = require("http-status-codes");
const { notifyProjectCommented } = require("../services/notificationService");

// Add comment
exports.addComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const projectId = req.params.id;

    const project = await Project.findById(projectId).populate("owner", "username");
    if (!project) return res.error("Project not found", StatusCodes.NOT_FOUND);

    const comment = await Comment.create({
      project: projectId,
      user: req.user._id || req.user.userId,
      content,
    });

    await comment.populate("user", "name profilePhoto");

    // Send notification to project owner (non-blocking)
    if (project.owner && project.owner._id) {
      notifyProjectCommented(
        project.owner._id.toString(),
        (req.user._id || req.user.userId).toString(),
        project._id.toString(),
        project.title,
        project.slug,
        project.owner.username,
        content
      ).catch((err) => {
        console.error("Failed to send comment notification:", err);
        // Don't throw - notification failure shouldn't break the comment creation
      });
    }

    return res.success(StatusCodes.OK, "Comment added successfully", comment);
  } catch (err) {
    next(err);
  }
};

// Get comments for project
exports.getCommentsByProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.error("Invalid project id", StatusCodes.BAD_REQUEST);
    }

    // Ensure project exists (avoids confusing downstream errors)
    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      return res.error("Project not found", StatusCodes.NOT_FOUND);
    }

    const comments = await Comment.find({ project: projectId })
      .populate("user", "name profilePhoto")
      .sort({ createdAt: -1 });

    return res.success(StatusCodes.OK, "Comments retrieved successfully", comments);
  } catch (err) {
    next(err);
  }
};
