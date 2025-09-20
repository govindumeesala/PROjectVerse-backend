const {StatusCodes} = require('http-status-codes')
const sharp = require("sharp");
const streamifier = require("streamifier");
const mongoose = require("mongoose");

// local imports
const User = require("../models/User");
const Project = require("../models/Project");
const Collaboration = require("../models/Collaboration");
const cloudinary = require("../config/cloudinary");
const AppError = require('../utils/AppError');

// GET /api/users   (get logged-in user's basic profile)
exports.getUserDetails = async (req, res, next) => {
  try {
    // req.user is populated by your protect middleware 
    const userId = req.user?.userId;
    if (!userId) {
      return next(new AppError("Unauthorized", StatusCodes.UNAUTHORIZED));
    }

    // Select only the required fields. Using .lean() returns a plain JS object (faster).
    const user = await User.findById(userId)
      .select("_id name email idNumber year summary profilePhoto socials username")
      .lean();

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    return res.success(StatusCodes.OK, "User details retrieved successfully", user);
  } catch (err) {
    next(err);
  }
};

exports.getUserDetailsByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return next(new AppError("Invalid username", StatusCodes.BAD_REQUEST));
    }

    const loggedInUserId = req.user?.userId;

    const user = await User.findOne({ username })
      .select("_id name email idNumber year summary profilePhoto socials username")
      .lean();

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    if (loggedInUserId && loggedInUserId.toString() === user._id.toString()) {
      user.isOwner = true;
    } else {
      user.isOwner = false;
    }

    return res.success(StatusCodes.OK, "User details retrieved successfully", user);
  } catch (err) {
    next(err);
  }
};

// Helper function to upload a buffer to Cloudinary using a stream
const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "profile_photos" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Update logged-in user's profile details (with image preprocessing)
exports.updateUser = async (req, res, next) => {
  try {
    // Get userId from protect middleware
    const userId = req.user.userId;
    let updateData = { ...req.body };

    // Parse socials if sent as JSON string (from FormData)
    if (typeof updateData.socials === "string") {
      try {
        updateData.socials = JSON.parse(updateData.socials);
      } catch {
        updateData.socials = {};
      }
    }

    if (!userId) {
      throw new AppError("User id not provided", StatusCodes.BAD_REQUEST);
    }

    // If an image file is provided, process and upload it
    if (req.file) {
      // Use sharp to resize and optimize the image from memory
      const processedBuffer = await sharp(req.file.buffer)
        .resize(300, 300) // resize to 300x300 pixels
        .jpeg({ quality: 80 }) // convert to JPEG at 80% quality
        .toBuffer();

      // Upload the processed image buffer to Cloudinary
      const result = await uploadBufferToCloudinary(processedBuffer);
      updateData.profilePhoto = result.secure_url;
    }

    // Update the user document with provided fields
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }
    res.success(StatusCodes.OK, "User updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};

// controllers/userController.js or similar
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}, "name email _id").lean();

    if (users.length === 0) {
      throw new AppError("No users found", StatusCodes.NOT_FOUND);
    }
    res.success(StatusCodes.OK, "All users retrieved successfully", users);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/stats
exports.getUserStats = async (req, res, next) => {
  try {
    const username = req.params.username;
    if (!username) {
      return next(new AppError("username not provided", StatusCodes.BAD_REQUEST));
    }

    const user = await User.findOne({ username }).select("_id").lean();
    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    const uid = user._id;

    const loggedInUserId = req.user?.userId;

    // Project counts: active & completed
    const [activeProjects, completedProjects] = await Promise.all([
      Project.countDocuments({ owner: uid, status: "ongoing" }),
      Project.countDocuments({ owner: uid, status: "completed" }),
    ]);

    // projectsOwned can be derived from the above:
    const projectsOwned = (activeProjects || 0) + (completedProjects || 0);

    // collaborationsCount: number of collaboration records on user's projects (owner === userId)
    const collaborationsCount = await Collaboration.countDocuments({ owner: uid });

    // contributionsCount: number of collaboration records where user is a collaborator.
    // If you want to exclude contributions to own projects, add owner: { $ne: uid }.
    const contributionsCount = await Collaboration.countDocuments({
      collaborator: uid,
      owner: { $ne: uid }, 
    });

    // bookmarksCount from user doc (only bookmarks array length)
    const userDoc = await User.findById(uid).select("bookmarks").lean();
    const bookmarksCount = (userDoc && Array.isArray(userDoc.bookmarks)) ? userDoc.bookmarks.length : 0;

    const stats = {
      projectsOwned,
      activeProjects: activeProjects || 0,
      completedProjects: completedProjects || 0,
      collaborationsCount: collaborationsCount || 0,
      contributionsCount: contributionsCount || 0,
      bookmarksCount,
      isOwner: loggedInUserId && loggedInUserId.toString() === uid.toString(),
    };

    return res.success(StatusCodes.OK, "User stats retrieved successfully", stats);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/bookmarks
 * Returns bookmarked projects stored on the user's document.
 */
/**
 * GET /api/user/bookmarks
 */
exports.getBookmarks = async (req, res, next) => {
  try {
    const username = req.params.username;
    if (!username) throw new AppError("username not provided", StatusCodes.BAD_REQUEST);

    const loggedInUserId = req?.user?.userId;

    const { page, limit, skip, filters } = req.paging;

    const user = await User.findOne({ username }).select("bookmarks").lean();
    if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

    const bookmarkIds = user.bookmarks || [];

    if (!bookmarkIds.length) {
      return res.success(StatusCodes.OK, "No bookmarks found", {
        items: [],
        total: 0,
        page,
        limit,
      });
    }

    const baseFilter = {
      _id: { $in: bookmarkIds },
      ...filters,
    };

    const [total, items] = await Promise.all([
      Project.countDocuments(baseFilter),
      Project.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("owner", "name profilePhoto _id")
        .lean(),
    ]);

    // attach contributors
    const projectIds = items.map((p) => p._id).filter(Boolean);
    if (projectIds.length > 0) {
      const collaborations = await Collaboration.find({ project: { $in: projectIds } })
        .populate("collaborator", "name profilePhoto _id")
        .lean();

      const map = collaborations.reduce((acc, c) => {
        if (!c.project) return acc;
        const pid = c.project.toString();
        if (!acc[pid]) acc[pid] = [];
        if (c.collaborator) {
          acc[pid].push({
            _id: c.collaborator._id,
            name: c.collaborator.name,
            profilePhoto: c.collaborator.profilePhoto,
            role: c.role || undefined,
            contributionSummary: c.contributionSummary || undefined,
          });
        }
        return acc;
      }, {});

      items.forEach((p) => {
        const arr = map[p._id.toString()] || [];
        if (arr.length > 0) p.contributors = arr;
      });
    }

    res.success(StatusCodes.OK, "Bookmarks retrieved successfully", {
      items,
      total,
      page,
      limit,
      isOwner: loggedInUserId && loggedInUserId.toString() === user._id.toString(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/bookmarks/:projectId
 * Body: { action: "add" | "remove" }
 *
 * Adds or removes projectId from the authenticated user's bookmarks.
 * Returns a simple action result in data: { action: "added" | "removed", projectId }
 */
exports.toggleBookmark = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) throw new AppError("Authentication required", StatusCodes.UNAUTHORIZED);

    const { projectId } = req.params;
    const { action } = req.body || {};

    if (!projectId) {
      throw new AppError("Invalid projectId", StatusCodes.BAD_REQUEST);
    }

    if (!["add", "remove"].includes(action)) {
      throw new AppError("Invalid action. Must be 'add' or 'remove'.", StatusCodes.BAD_REQUEST);
    }

    // ensure project exists
    const project = await Project.findById(projectId).select("_id title").lean();
    if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

    // fetch user bookmarks
    const user = await User.findById(userId).select("bookmarks");
    if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);

    const alreadyBookmarked = (user.bookmarks || []).some((id) => id.toString() === projectId.toString());

    if (action === "add") {
      if (alreadyBookmarked) {
        return res.success(StatusCodes.OK, "Project already bookmarked", { action: "added", projectId });
      }
      user.bookmarks.push(projectId);
      await user.save();
      return res.success(StatusCodes.OK, "Project added to bookmarks", { action: "added", projectId });
    } else {
      // action === "remove"
      if (!alreadyBookmarked) {
        return res.success(StatusCodes.OK, "Project not bookmarked", { action: "removed", projectId });
      }
      user.bookmarks = (user.bookmarks || []).filter((id) => id.toString() !== projectId.toString());
      await user.save();
      return res.success(StatusCodes.OK, "Project removed from bookmarks", { action: "removed", projectId });
    }
  } catch (err) {
    next(err);
  }
};