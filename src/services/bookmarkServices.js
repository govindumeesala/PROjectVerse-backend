const User = require("../models/User");
const Project = require("../models/Project");
const AppError = require("../utils/AppError");

// Get user bookmarks
exports.getBookmarks = async (userId) => {
  const user = await User.findById(userId).populate("bookmarks");
  if (!user) throw new AppError("User not found", 404);
  return user.bookmarks;
};

// Add a bookmark
exports.bookmarkProject = async (userId, projectId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);

  if (user.bookmarks.includes(projectId)) {
    throw new AppError("Project already bookmarked", 400);
  }

  user.bookmarks.push(projectId);
  await user.save();
  return project;
};

// Remove a bookmark
exports.unBookmarkProject = async (userId, projectId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);

  user.bookmarks = user.bookmarks.filter(
    (bookmarkId) => bookmarkId.toString() !== projectId.toString()
  );
  await user.save();
  return { removed: projectId };
};
