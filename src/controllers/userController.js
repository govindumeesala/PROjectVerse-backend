const {StatusCodes} = require('http-status-codes')
const sharp = require("sharp");
const streamifier = require("streamifier");

// local imports
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const AppError = require('../utils/AppError');

// Get user details.
exports.getUserDetails = async (req, res, next) => {
  try {
    // `req.user` is populated by the protect middleware.
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", StatusCodes.NOT_FOUND);
    }
    res.success(StatusCodes.OK, "User details retrieved successfully", user);
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
    }).select("name email year idNumber profilePhoto summary");

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
    const users = await User.find({}, "name email");

    if (users.length === 0) {
      throw new Error("No users found");
    }
    res.success(StatusCodes.OK, "All users retrieved successfully", users);
  } catch (err) {
    next(err);
  }
};
