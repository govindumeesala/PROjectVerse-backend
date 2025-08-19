const Project = require("../models/Project");
const User = require("../models/User"); // Import the User model to update it
const Collaboration = require("../models/Collaboration");
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
    const owner = req.user.userId;
    const { 
      title, 
      description, 
      domain, 
      githubURL, 
      deploymentURL, 
      status, 
      techStack, 
      contributors = [], // array of { userId, role?, contributionSummary? }
      lookingForContributors 
    } = req.body;

    let projectPhotoUrl;

    // ✅ handle image upload
    if (req.file) {
      const processedBuffer = await sharp(req.file.buffer)
        .resize(500, 300)
        .jpeg({ quality: 80 })
        .toBuffer();

      const result = await uploadBufferToCloudinary(processedBuffer);
      projectPhotoUrl = result.secure_url;
    }

    // ✅ ensure tech stack is array
    const techStackArray =
      typeof techStack === "string" ? JSON.parse(techStack) : techStack;

    // ✅ create project
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
      lookingForContributors,
      requests: []
    });

    // ✅ link project to owner
    await User.findByIdAndUpdate(owner, { $push: { projects: newProject._id } });

    // ✅ create collaboration for the owner
    await Collaboration.create({
      project: newProject._id,
      owner,
      collaborator: owner,
      role: "Owner",
      contributionSummary: "Project creator"
    });

    // ✅ create collaborations for contributors if provided
    if (contributors.length > 0) {
      const collabs = contributors.map(c => ({
        project: newProject._id,
        owner,
        collaborator: c.userId,
        role: c.role || "Contributor",
        contributionSummary: c.contributionSummary || ""
      }));
      await Collaboration.insertMany(collabs);

      // also link project to each contributor in User.projects
      const contributorIds = contributors.map(c => c.userId);
      await User.updateMany(
        { _id: { $in: contributorIds } },
        { $push: { projects: newProject._id } }
      );
    }

    // ✅ send success response
    res.success(StatusCodes.CREATED, "Project created successfully", newProject);

  } catch (err) {
    next(err);
  }
};



exports.getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const projects = await Project.find({ owner: userId })
      .sort({ createdAt: -1 }) // newest first
      .select("title summary createdAt status techStack"); 
      // only selecting fields we need for list view

    res.success(
      StatusCodes.OK,
      "User projects retrieved successfully",
      projects
    );
  } catch (err) {
    next(err);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "name email profilePhoto") // show basic owner details
      .populate("contributors.user", "name email profilePhoto"); // if you maintain contributors

    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }

    res.success(StatusCodes.OK, "Project details retrieved", project);
  } catch (err) {
    next(err);
  }
};
