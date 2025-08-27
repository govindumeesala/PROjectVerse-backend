const Project = require("../models/Project");
const User = require("../models/User"); 
const User = require("../models/User");
const Collaboration = require("../models/Collaboration");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const streamifier = require("streamifier");
const { StatusCodes } = require("http-status-codes");
const AppError = require("../utils/AppError"); // ✅ custom error class (if you have one)
const mongoose = require("mongoose");

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
      contributors = [],
      lookingForContributors,
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
      requests: [],
    });

    // ✅ link project to owner
    await User.findByIdAndUpdate(owner, { $push: { projects: newProject._id } });

    // ✅ handle contributors
    if (contributors.length > 0) {
      const collabs = contributors.map((c) => ({
        project: newProject._id,
        owner,
        collaborator: c._id || c.userId,
        role: c.role || "Contributor",
        contributionSummary: c.contributionSummary || "",
      }));
      await Collaboration.insertMany(collabs);

      const contributorIds = contributors.map((c) => c.userId);
      await User.updateMany(
        { _id: { $in: contributorIds } },
        { $push: { projects: newProject._id } }
      );
    }

    return res.success(
      StatusCodes.CREATED,
      "Project created successfully",
      newProject
    );
  } catch (err) {
    next(err);
  }
};

// GET USER PROJECTS
exports.getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const projects = await Project.find({ owner: userId })
      .sort({ createdAt: -1 })
      .select("title description createdAt status techStack");

    return res.success(
      StatusCodes.OK,
      "User projects retrieved successfully",
      projects
    );
  } catch (err) {
    next(err);
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
exports.getProjectFeed = async (req, res, next) => {
  try {
    const { cursor, limit = 10, techStack, domain, search } = req.query;
    let query = {};

    if (cursor) query.createdAt = { $lt: new Date(cursor) };
    if (techStack)
      query.techStack = { $in: techStack.split(",").map((s) => s.trim()) };
    if (domain)
      query.domain = { $in: domain.split(",").map((s) => s.trim()) };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let projects = await Project.find(query)
      .populate("owner", "name profilePhoto")
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1);

    let nextCursor = null;
    if (projects.length > limit) {
      nextCursor = projects[limit - 1].createdAt;
      projects = projects.slice(0, limit);
    }

    return res.success(
      StatusCodes.OK,
      "Projects retrieved successfully",
      { projects, nextCursor }
    );
  } catch (err) {
    next(err);
  }
};

// LIKE PROJECT
exports.likeProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }
    if (!project.likes.includes(req.user.userId)) {
      project.likes.push(req.user.userId);
      await project.save();
    }

    return res.success(
      StatusCodes.OK,
      "Project liked successfully",
      { likes: project.likes.length }
    );
  } catch (err) {
    next(err);
  }
};

// UNLIKE PROJECT
exports.unlikeProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      throw new AppError("Project not found", StatusCodes.NOT_FOUND);
    }

    project.likes = project.likes.filter(
      (id) => id.toString() !== req.user.userId.toString()
    );
    await project.save();

    return res.success(
      StatusCodes.OK,
      "Project unliked successfully",
      { likes: project.likes.length }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/project/my-projects
 */
exports.getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) throw new AppError("Authentication required", StatusCodes.UNAUTHORIZED);

    const { page, limit, skip, filters } = req.paging;

    const baseFilter = { owner: new mongoose.Types.ObjectId(userId), ...filters };

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
      const collaborations = await Collaboration.find({ project: { $in: projectIds } })
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
    const userId = req.user && req.user.userId;
    if (!userId) throw new AppError("Authentication required", StatusCodes.UNAUTHORIZED);

    const { page, limit, skip, filters } = req.paging;

    // Find collaborations where collaborator == userId
    const collaborationsByUser = await Collaboration.find({ collaborator: userId }).lean();

    const projectIds = collaborationsByUser.map((c) => c.project).filter(Boolean);

    if (!projectIds.length) {
      return res.success(StatusCodes.OK, "No collaborated projects found", {
        items: [],
        total: 0,
        page,
        limit,
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
      const collaborations = await Collaboration.find({ project: { $in: fetchedProjectIds } })
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
    });
  } catch (err) {
    next(err);
  }
};