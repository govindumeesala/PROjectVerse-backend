const User = require("../models/User");
const Project = require("../models/Project");
const Collaboration = require("../models/Collaboration");
const AppError = require("../utils/AppError");
const { StatusCodes } = require("http-status-codes");

const mongoose = require("mongoose");

exports.getProjectFeed = async ({ userId, cursor, limit, techStack, domain, search }) => {
  let match = {};

  // Cursor-based pagination
  if (cursor) {
    match.createdAt = { $lt: new Date(cursor) };
  }

  // Tech stack filter
  if (techStack) {
    const techStackArray = Array.isArray(techStack)
      ? techStack
      : techStack.split(",").map((s) => s.trim());
    if (techStackArray.length > 0) {
      match.techStack = { $in: techStackArray };
    }
  }

  // Domain filter
  if (domain) {
    const domainArray = Array.isArray(domain)
      ? domain
      : domain.split(",").map((s) => s.trim());
    if (domainArray.length > 0) {
      match.domain = { $in: domainArray };
    }
  }

  // Search filter
  if (search) {
    match.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Aggregation pipeline
  const projects = await Project.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: Number(limit) + 1 },

    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          { $project: { username: 1, name: 1, profilePhoto: 1 } }, // ✅ add username
        ],
      },
    },
    { $unwind: "$owner" },

    {
      $lookup: {
        from: "collaborations",
        localField: "_id",
        foreignField: "project",
        as: "collaborations",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "collaborator",
              foreignField: "_id",
              as: "collaborator",
              pipeline: [{ $project: { _id: 1, name: 1, profilePhoto: 1 } }],
            },
          },
          { $unwind: "$collaborator" },
          { $replaceRoot: { newRoot: "$collaborator" } },
        ],
      },
    },

    {
      $lookup: {
        from: "comments",
        let: { projectId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$project", "$$projectId"] } } },
          { $count: "count" },
        ],
        as: "commentsCount",
      },
    },
    {
      $addFields: {
        commentsCount: {
          $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0],
        },
      },
    },
    {
      $addFields: {
        likesCount: { $size: { $ifNull: ["$likes", []] } },
        likedByUser: {
          $cond: [
            userId ? { $in: [userId, { $ifNull: ["$likes", []] }] } : false,
            true,
            false,
          ],
        },
      },
    },
    ...(userId
      ? [
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "bookmarks",
              as: "bookmarkedUsers",
              pipeline: [{ $match: { _id: userId } }],
            },
          },
          {
            $addFields: {
              bookmarkedByUser: { $gt: [{ $size: "$bookmarkedUsers" }, 0] },
            },
          },
          { $project: { bookmarkedUsers: 0 } },
        ]
      : [{ $addFields: { bookmarkedByUser: false } }]),
  ]);

  let nextCursor = null;
  let finalProjects = projects;
  console.log("Fetched projects:", projects.length);
  if (projects.length > limit) {
    nextCursor = projects[limit - 1].createdAt;
    finalProjects = projects.slice(0, limit);
  }

  return { projects: finalProjects, nextCursor };
};


exports.getProjectByUsernameAndTitle = async (username, projectTitle) => {
  const user = await User.findOne({ username }).select("_id username name profilePhoto");
  if (!user) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  const project = await Project.findOne({
    owner: user._id,
    title: projectTitle,
  })
    .collation({ locale: "en", strength: 2 }) // case-insensitive
    .populate("owner", "username name profilePhoto")
    .lean();

  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  return project;
};

exports.requestToJoinProject = async (userId, username, projectTitle) => {
  const owner = await User.findOne({ username }).select("_id");
  if (!owner) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  const project = await Project.findOne({ owner: owner._id, title: projectTitle })
    .collation({ locale: "en", strength: 2 })
    .select("_id lookingForContributors");
  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  if (!project.lookingForContributors) {
    throw new AppError("This project is not accepting contributors", StatusCodes.BAD_REQUEST);
  }

  const existing = await Collaboration.findOne({
    project: project._id,
    collaborator: userId,
  });

  if (existing) {
    throw new AppError("Already requested or a collaborator", StatusCodes.CONFLICT);
  }

  const newRequest = await Collaboration.create({
    project: project._id,
    owner: owner._id,
    collaborator: userId,
    role: "Contributor",
    contributionSummary: "",
    status: "pending",
  });

  return newRequest;
};

exports.updateProject = async (userId, username, projectTitle, updates) => {
  const owner = await User.findOne({ username }).select("_id");
  if (!owner) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  // ✅ Ensure only the actual owner can edit
  if (owner._id.toString() !== userId.toString()) {
    throw new AppError("Not authorized to update this project", StatusCodes.FORBIDDEN);
  }

  const project = await Project.findOneAndUpdate(
    { owner: owner._id, title: projectTitle },
    { ...updates, updatedAt: Date.now() },
    { new: true }
  )
    .collation({ locale: "en", strength: 2 })
    .populate("owner", "username name profilePhoto");

  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  return project;
};
