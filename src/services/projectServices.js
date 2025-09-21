const User = require("../models/User");
const Project = require("../models/Project");
const Collaboration = require("../models/Collaboration");
const AppError = require("../utils/AppError");
const { StatusCodes } = require("http-status-codes");
const ProjectRequest = require("../models/ProjectRequest");
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
  if (projects.length > limit) {
    nextCursor = projects[limit - 1].createdAt;
    finalProjects = projects.slice(0, limit);
  }

  return { projects: finalProjects, nextCursor };
};


exports.getProjectByUsernameAndSlug = async (username, slug, userId = null) => {
  const ownerUser = await User.findOne({ username }).select("_id username name profilePhoto");
  if (!ownerUser) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  // Build aggregation to enrich project with likes/bookmarks/comments and contributors
  const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;
  const [project] = await Project.aggregate([
    {
      $match: {
        owner: ownerUser._id,
        slug: slug,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { _id: 1, username: 1, name: 1, profilePhoto: 1 } }],
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
              pipeline: [
                { $project: { _id: 1, username: 1, name: 1, profilePhoto: 1 } },
              ],
            },
          },
          { $unwind: "$collaborator" },
          { $replaceRoot: { newRoot: "$collaborator" } },
        ],
      },
    },
    // compute counts and flags
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
        commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0] },
        likesCount: { $size: { $ifNull: ["$likes", []] } },
        likedByUser: userObjectId
          ? { $in: [userObjectId, { $ifNull: ["$likes", []] }] }
          : false,
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
              pipeline: [{ $match: { _id: userObjectId } }],
            },
          },
          { $addFields: { bookmarkedByUser: { $gt: [{ $size: "$bookmarkedUsers" }, 0] } } },
          { $project: { bookmarkedUsers: 0 } },
        ]
      : [{ $addFields: { bookmarkedByUser: false } }]),
    // unify contributors: include collaborators + owner
    {
      $addFields: {
        contributors: {
          $setUnion: [
            { $ifNull: ["$collaborations", []] },
            [{ _id: "$owner._id", username: "$owner.username", name: "$owner.name", profilePhoto: "$owner.profilePhoto" }],
          ],
        },
      },
    },
    { $project: { collaborations: 0 } },
  ]);

  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  return project;
};


exports.requestToJoinProject = async (userId, username, slug, message, roleRequested) => {
  const owner = await User.findOne({ username }).select("_id");
  if (!owner) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  const project = await Project.findOne({ owner: owner._id, slug })
    .collation({ locale: "en", strength: 2 })
    .select("_id lookingForContributors");
  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  if (!project.lookingForContributors) {
    throw new AppError("This project is not accepting contributors", StatusCodes.BAD_REQUEST);
  }

  // already collaborator?
  const existingCollab = await Collaboration.findOne({
    project: project._id,
    collaborator: userId,
  });
  if (existingCollab) {
    throw new AppError("Already a collaborator", StatusCodes.CONFLICT);
  }

  // already requested?
  const existingReq = await ProjectRequest.findOne({
    project: project._id,
    requester: userId,
    status: "pending",
  });
  if (existingReq) {
    throw new AppError("Already requested", StatusCodes.CONFLICT);
  }

  const newRequest = await ProjectRequest.create({
    project: project._id,
    requester: userId,
    message,
    roleRequested,
  });

  return newRequest;
};

exports.respondToRequest = async (ownerId, requestId, action) => {
  const request = await ProjectRequest.findById(requestId).populate("project requester");
  if (!request) throw new AppError("Request not found", StatusCodes.NOT_FOUND);

  // only project owner can approve/reject
  if (String(request.project.owner) !== String(ownerId)) {
    throw new AppError("Not authorized to respond to this request", StatusCodes.FORBIDDEN);
  }

  if (request.status !== "pending") {
    throw new AppError("This request has already been handled", StatusCodes.BAD_REQUEST);
  }

  if (action === "accept") {
    request.status = "approved";
    request.reviewedBy = ownerId;
    request.reviewedAt = new Date();
    await request.save();

    // create collaboration record
    await Collaboration.create({
      project: request.project._id,
      owner: request.project.owner,
      collaborator: request.requester._id,
      role: request.roleRequested || "Contributor",
      contributionSummary: "",
      status: "active",
    });

    return { success: true, message: "Request approved and collaborator added" };
  }

  if (action === "reject") {
    request.status = "rejected";
    request.reviewedBy = ownerId;
    request.reviewedAt = new Date();
    await request.save();

    return { success: true, message: "Request rejected" };
  }

  throw new AppError("Invalid action", StatusCodes.BAD_REQUEST);
};


exports.updateProject = async (userId, username, projectSlug, updates) => {
  const owner = await User.findOne({ username }).select("_id");
  if (!owner) throw new AppError("Owner not found", StatusCodes.NOT_FOUND);

  // ✅ Ensure only the actual owner can edit
  if (owner._id.toString() !== userId.toString()) {
    throw new AppError("Not authorized to update this project", StatusCodes.FORBIDDEN);
  }

  const project = await Project.findOneAndUpdate(
    { owner: owner._id, slug: projectSlug },
    { ...updates, updatedAt: Date.now() },
    { new: true }
  )
    .collation({ locale: "en", strength: 2 })
    .populate("owner", "username name profilePhoto");

  if (!project) throw new AppError("Project not found", StatusCodes.NOT_FOUND);

  return project;
};
