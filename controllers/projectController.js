const Project = require("../models/Project");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");
const streamifier = require("streamifier");

// Cloudinary configuration – make sure your env variables are set
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    // Get owner from the auth middleware (which sets req.user)
    const owner = req.user.userId;
    const { title, description, domain, githubURL, deploymentURL, status, techStack } = req.body;

    let projectPhotoUrl;

    // Process and upload image if provided
    if (req.file) {
      // Resize and convert the image using sharp (adjust dimensions as needed)
      const processedBuffer = await sharp(req.file.buffer)
        .resize(500, 300) // For example, a 500x300 pixel image
        .jpeg({ quality: 80 })
        .toBuffer();
      const result = await uploadBufferToCloudinary(processedBuffer);
      projectPhotoUrl = result.secure_url;
    }

    // techStack can be sent as a JSON string from the client or directly as an array.
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
      requests: [] // Initially no requests
    });

    res.status(201).json({ success: true, data: newProject });
  } catch (error) {
    next(error);
  }
};
