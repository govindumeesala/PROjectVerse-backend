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
      .select("_id name email idNumber year summary profilePhoto socials")
      .lean();

    if (!user) {
      return next(new AppError("User not found", StatusCodes.NOT_FOUND));
    }

    // Use your res.success helper which expects (data, message?, statusCode?)
    // Send a minimal object (avoid leaking internal DB fields)
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
    const users = await User.find({}, "name email _id");

    if (users.length === 0) {
      throw new Error("No users found");
    }
    res.success(StatusCodes.OK, "All users retrieved successfully", users);
  } catch (err) {
    next(err);
  }
};

// GET /api/users/stats (get logged-in user's stats)
exports.getMyStats = async (req, res, next) => {
  try {
    const uid = req.user && req.user.userId;
    if (!uid) {
      return next(new AppError("Unauthorized: missing user id", StatusCodes.UNAUTHORIZED));
    }

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
    };

    return res.success(StatusCodes.OK, "User stats retrieved successfully", stats);
  } catch (err) {
    next(err);
  }
};
