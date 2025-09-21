const Project = require("../models/Project");
const User = require("../models/User");
const Collaboration = require("../models/Collaboration");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const streamifier = require("streamifier");
const { StatusCodes } = require("http-status-codes");
const AppError = require("../utils/AppError"); // ✅ custom error class (if you have one)
const mongoose = require("mongoose");
const projectService = require("../services/projectServices");
const slugify = require("slugify");
const catchAsync = require("../utils/catchAsync");

// Helper: upload buffer to Cloudinary
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

// CREATE PROJECT
// src/controllers/projectController.js

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
      contributors = [], // The array of user IDs from the frontend
      lookingForContributors,
      additionalURL,
    } = req.body;

    let projectPhotoUrl;

    // ✅ handle image upload (no change here, this is correct)
    if (req.file) {
      const processedBuffer = await sharp(req.file.buffer)
        .resize(500, 300)
        .jpeg({ quality: 80 })
        .toBuffer();
      const result = await uploadBufferToCloudinary(processedBuffer);
      projectPhotoUrl = result.secure_url;
    }

    // ✅ create project (no change here, this is correct)
    const newProject = await Project.create({
      title,
      description,
      domain,
      techStack, // Already an array from the frontend
      githubURL,
      deploymentURL,
      status,
      owner,
      projectPhoto: projectPhotoUrl,
      lookingForContributors,
      additionalURL,
      requests: [],
    });

    // ✅ Link project to owner (correct)
    await User.findByIdAndUpdate(owner, {
      $push: { projects: newProject._id },
    });

    // ✅ handle contributors
    if (contributors.length > 0) {
      // Correctly map the user IDs to the Collaboration model
      const collabs = contributors.map((contributorId) => ({
        project: newProject._id,
        owner,
        collaborator: contributorId, // Use the ID directly
        role: "Contributor", // Default role
        contributionSummary: "",
      }));
      await Collaboration.insertMany(collabs);

      // Correctly update users to link the new project
      await User.updateMany(
        { _id: { $in: contributors } }, // `contributors` is already the array of IDs
        { $push: { projects: newProject._id } }
      );
    }

    return res.success(StatusCodes.CREATED , "Project created successfully", newProject);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.title) {
      console.error(err);
      return res.status(400).json({
        success: false,
        message: "You already have a project with this title. Choose another.",
      });
    }
    next(err);
  }
};


exports.checkTitle = async (req, res) => {
  try {
    const owner = req.user.userId;
    const { title } = req.body;

    if (!title) {
      return res
        .status(400)
        .json({ available: false, message: "Title is required" });
    }

    // 🔑 Generate slug from title
    const slug = slugify(title, { lower: true, strict: true });

    // 🔎 Check if a project with same slug exists for this owner
    const exists = await Project.findOne({ owner, slug });

    return res.json({
      available: !exists,
      message: exists
        ? "You already used this title."
        : "This title is available.",
    });
  } catch (err) {
    console.error("Error checking title:", err);
    return res
      .status(500)
      .json({ available: false, message: "Server error" });
  }
};

// GET PROJECT BY ID
exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "name email profilePhoto")
      .populate("contributors.user", "name email profilePhoto");

    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }

    return res.success(StatusCodes.OK, "Project details retrieved", project);
  } catch (err) {
    next(err);
  }
};

// FEED
// src/controllers/projectController.js
exports.getProjectFeed = async (req, res, next) => {
  try {
    const { cursor, limit = 10, techStack, domain, search } = req.query;

    const userId = req.user?.userId
      ? new mongoose.Types.ObjectId(req.user.userId)
      : null;
    const { projects, nextCursor } = await projectService.getProjectFeed({
      userId,
      cursor,
      limit: Number(limit),
      techStack,
      domain,
      search,
    });
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Projects retrieved successfully",
      data: {
        projects,
        nextCursor,
      },
    });
  } catch (err) {
    next(err);
  }
};


// LIKE PROJECT
exports.likeProject = async (req, res, next) => {
  const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }
    if (!project.likes.includes(userObjectId)) {
      project.likes.push(userObjectId);
      await project.save();
    }

    return res.success(StatusCodes.OK, "Project liked successfully", {
      likes: project.likes.length,
    });
  } catch (err) {
    next(err);
  }
};

// UNLIKE PROJECT
exports.unlikeProject = async (req, res, next) => {
  const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }

    project.likes = project.likes.filter((id) => !id.equals(userObjectId));
    await project.save();

    return res.success(StatusCodes.OK, "Project unliked successfully", {
      likes: project.likes.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/project/my-projects
 */
exports.getUserProjects = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      return next(new AppError("Invalid username", StatusCodes.BAD_REQUEST));
    }
    const loggedInUserId = req?.user?.userId || null;

    const { page, limit, skip, filters } = req.paging;

    const user = await User.findOne({ username }).select("_id").lean();

    const baseFilter = {
      owner: new mongoose.Types.ObjectId(user._id),
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

    // attach contributors for each project (if any)
    const projectIds = items.map((p) => p._id).filter(Boolean);
    if (projectIds.length > 0) {
      const collaborations = await Collaboration.find({
        project: { $in: projectIds },
      })
        .populate("collaborator", "name profilePhoto _id")
        .lean();

      const map = collaborations.reduce((acc, c) => {
        if (!c.project) return acc;
        const pid = c.project.toString();
        if (!acc[pid]) acc[pid] = [];
        // only include if collaborator is populated and exists
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

      // attach to items only when non-empty
      items.forEach((p) => {
        const arr = map[p._id.toString()] || [];
        if (arr.length > 0) p.contributors = arr;
      });
    }

    // ensure only requested fields exist (title, domain, techStack, status, owner, contributors)
    // if you want to trim other fields you can map items here. For now, return full project object with added contributors.
    res.success(StatusCodes.OK, "My projects retrieved successfully", {
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
 * GET /api/project/contributed
 */
exports.getContributedProjects = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) {
      return next(new AppError("Invalid username", StatusCodes.BAD_REQUEST));
    }
    const loggedInUserId = req?.user?.userId;

    const { page, limit, skip, filters } = req.paging;

    const user = await User.findOne({ username }).select("_id");
    if (!user) {
      throw new AppError("user not found", StatusCodes.NOT_FOUND);
    }

    const userId = user._id;

    // Find collaborations where collaborator == userId
    const collaborationsByUser = await Collaboration.find({
      collaborator: userId,
    }).lean();

    const projectIds = collaborationsByUser
      .map((c) => c.project)
      .filter(Boolean);

    if (!projectIds.length) {
      return res.success(StatusCodes.OK, "No collaborated projects found", {
        items: [],
        total: 0,
        page,
        limit,
        isOwner: loggedInUserId && loggedInUserId.toString() === userId.toString(),
      });
    }

    const baseFilter = {
      _id: { $in: projectIds },
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

    // attach contributors for each project (if any)
    const fetchedProjectIds = items.map((p) => p._id).filter(Boolean);
    if (fetchedProjectIds.length > 0) {
      const collaborations = await Collaboration.find({
        project: { $in: fetchedProjectIds },
      })
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

    res.success(StatusCodes.OK, "Collaborated projects retrieved", {
      items,
      total,
      page,
      limit,
      isOwner: loggedInUserId && loggedInUserId.toString() === userId.toString(),
    });
  } catch (err) {
    next(err);
  }
};

exports.getProjectPage = async (req, res, next) => {
  try {
    const { username, slug } = req.params;
    const userId = req.user?.userId || null;
    const project = await projectService.getProjectByUsernameAndSlug(
      username,
      slug,
      userId
    );

    // 🔑 add isOwner flag (compare logged-in user id with project.owner._id)
    const isOwner = userId && project.owner._id.toString() === userId.toString();

    // Compute alreadyRequested using ProjectRequest collection
    let alreadyRequested = false;
    let alreadyContributor = false;
    if (userId) {
      const ProjectRequest = require("../models/ProjectRequest");
      const Collaboration = require("../models/Collaboration");
      const [pending, collab] = await Promise.all([
        ProjectRequest.findOne({
          project: project._id,
          requester: userId,
          status: "pending",
        }).lean(),
        Collaboration.findOne({ project: project._id, collaborator: userId }).lean(),
      ]);
      alreadyRequested = Boolean(pending);
      alreadyContributor = Boolean(collab);
    }

    // If owner, include pending requests with basic requester details for UI
    let requests = [];
    if (isOwner) {
      const ProjectRequest = require("../models/ProjectRequest");
      const pendingRequests = await ProjectRequest.find({
        project: project._id,
        status: "pending",
      })
        .populate("requester", "username name profilePhoto")
        .lean();
      requests = pendingRequests.map((r) => ({
        _id: r._id,
        user: {
          _id: r.requester?._id,
          username: r.requester?.username,
          name: r.requester?.name,
          profilePhoto: r.requester?.profilePhoto,
        },
        roleRequested: r.roleRequested,
        message: r.message,
      }));
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: { ...project, isOwner, alreadyRequested, alreadyContributor, requests },
    });
  } catch (err) {
    next(err);
  }
};
exports.requestToJoin = catchAsync(async (req, res) => {
  const { username, slug } = req.params;
  const { message, roleRequested } = req.body;
  const request = await projectService.requestToJoinProject(
    req.user.userId,
    username,
    slug,
    message,
    roleRequested
  );

  res.status(201).json({
    success: true,
    message: "Join request sent",
    request,
  });
});

exports.respondToRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body;

  const result = await projectService.respondToRequest(
    req.user.userId,
    requestId,
    action
  );

  res.status(200).json({
    success: true,
    ...result,
  });
});


exports.updateProject = async (req, res, next) => {
  try {
    const { username, slug } = req.params;
    const userId = req.user.userId;

    const project = await projectService.updateProject(userId, username, slug, req.body);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (err) {
    next(err);
  }
};
