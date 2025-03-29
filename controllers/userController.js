// controllers/userController.js
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");
const streamifier = require("streamifier");

// Configure Cloudinary (ensure environment variables are set)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

exports.getUserDetails = async (req, res, next) => {
  try {
    // `req.user` is populated by the protect middleware.
    const userId = req.user.userId;
    const user = await User.findById(userId).select("name email");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
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

// Update logged-in user's profile details (with image pre-processing)
exports.updateUser = async (req, res, next) => {
  try {
    // Get userId from protect middleware
    const userId = req.user.userId;
    let updateData = { ...req.body };

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
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

