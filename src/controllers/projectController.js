const Project = require("../models/Project");
const User = require("../models/User"); // Import the User model to update it
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const streamifier = require("streamifier");
const {StatusCodes} = require("http-status-codes");

// Helper function to upload an image buffer to Cloudinary using a stream
const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "project_photos" },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

exports.createProject = async (req, res, next) => {
  try {
    // Get owner from auth middleware (req.user)
    const owner = req.user.userId;
    const { title, description, domain, githubURL, deploymentURL, status, techStack, contributors,lookingForContributors } = req.body;

    let projectPhotoUrl;

    // Process and upload image if provided
    if (req.file) {
      // Resize and optimize the image using sharp (adjust dimensions as needed)
      const processedBuffer = await sharp(req.file.buffer)
        .resize(500, 300) // Example: resize to 500x300 pixels
        .jpeg({ quality: 80 })
        .toBuffer();
      const result = await uploadBufferToCloudinary(processedBuffer);
      projectPhotoUrl = result.secure_url;
    }

    // Convert techStack from a string to an array if needed
    const techStackArray = typeof techStack === "string" ? JSON.parse(techStack) : techStack;

    // Create the project document in the database
    const newProject = await Project.create({
      title,
      description,
      domain,
      techStack: techStackArray,
      githubURL,
      deploymentURL,
      status,
      owner,
      projectPhoto: projectPhotoUrl,
      contributors: contributors || [], // Ensure contributors is an array
      lookingForContributors,
      requests: [] // Initially no requests
    });

    // Update the user document: add a reference to the newly created project.
    await User.findByIdAndUpdate(owner, { $push: { projects: newProject._id } });

    res.success(message="Project created successfully", status=StatusCodes.CREATED);
  } catch (error) {
    next(error);
  }
};
