const bookmarkServices = require("../services/bookmarkServices");

// Get all bookmarks
exports.getBookmarks = async (req, res, next) => {
  try {
    const bookmarks = await bookmarkServices.getBookmarks(req.user.userId);
    res.success(200, "Bookmarks fetched successfully", bookmarks);
  } catch (err) {
    next(err);
  }
};

// Add a bookmark
exports.bookmarkProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await bookmarkServices.bookmarkProject(req.user.userId, projectId);
    res.success(200, "Project bookmarked successfully", project);
  } catch (err) {
    next(err);
  }
};

// Remove a bookmark
exports.unBookmarkProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const result = await bookmarkServices.unBookmarkProject(req.user.userId, projectId);
    res.success(200, "Project unbookmarked successfully", result);
  } catch (err) {
    next(err);
  }
};
