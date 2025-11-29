// src/services/notificationService.js
// Service for creating and sending notifications via WebSocket and database
const Notification = require("../models/Notification");
const { emitToUser } = require("../socket");
const User = require("../models/User");
const Project = require("../models/Project");

/**
 * Create notification in database and emit via WebSocket
 * Gracefully handles failures - always saves to DB even if socket fails
 * 
 * @param {Object} params - Notification parameters
 * @param {string} params.recipientId - User ID who will receive the notification
 * @param {string|null} params.senderId - User ID who triggered the notification (null for system)
 * @param {string} params.type - Notification type (enum from schema)
 * @param {string} params.title - Notification title
 * @param {string} [params.message] - Optional notification message
 * @param {string} [params.link] - Optional redirect link (e.g., /username/slug)
 * @param {Object} [params.meta] - Optional metadata (projectId, slug, etc.)
 * @returns {Promise<Object>} - Created notification document
 */
const createAndSendNotification = async ({
  recipientId,
  senderId = null,
  type,
  title,
  message = null,
  link = null,
  meta = null,
}) => {
  try {
    // Validate recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      throw new Error(`Recipient user ${recipientId} not found`);
    }

    // Validate sender if provided
    if (senderId) {
      const sender = await User.findById(senderId);
      if (!sender) {
        console.warn(`⚠️ Sender ${senderId} not found, proceeding with null sender`);
        senderId = null;
      }
    }

    // Create notification in database
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      link,
      meta,
      read: false,
    });

    // Populate sender info for WebSocket payload
    await notification.populate("sender", "username name profilePhoto");

    // Prepare WebSocket payload
    const payload = {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      meta: notification.meta,
      read: notification.read,
      createdAt: notification.createdAt,
      sender: notification.sender
        ? {
            _id: notification.sender._id,
            username: notification.sender.username,
            name: notification.sender.name,
            profilePhoto: notification.sender.profilePhoto,
          }
        : null,
    };

    // Attempt to send via WebSocket (non-blocking)
    // If user is offline, notification is still saved in DB
    const socketSent = emitToUser(recipientId, "notification", payload);

    if (socketSent) {
      console.log(`✅ Notification created and sent via WebSocket to user ${recipientId}`);
    } else {
      console.log(`💾 Notification saved to DB for user ${recipientId} (offline or socket unavailable)`);
    }

    return notification;
  } catch (error) {
    // Log error but don't throw - notification creation should be non-blocking
    console.error("❌ Error creating notification:", error);
    
    // Still attempt to save to DB even if WebSocket fails
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type,
        title,
        message,
        link,
        meta,
        read: false,
      });
      console.log(`💾 Notification saved to DB (WebSocket failed): ${notification._id}`);
      return notification;
    } catch (dbError) {
      console.error("❌ Critical: Failed to save notification to database:", dbError);
      throw dbError; // Re-throw DB errors as they're critical
    }
  }
};

/**
 * Helper: Create notification for collaboration request received
 * @param {string} ownerId - Project owner ID
 * @param {string} requesterId - User requesting collaboration
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 */
const notifyCollabRequestReceived = async (
  ownerId,
  requesterId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername
) => {
  const requester = await User.findById(requesterId).select("name username");
  
  return createAndSendNotification({
    recipientId: ownerId,
    senderId: requesterId,
    type: "collab_request_received",
    title: "New Collaboration Request",
    message: `${requester?.name || requester?.username} requested to join your project "${projectTitle}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      requesterId,
      requesterName: requester?.name,
      requesterUsername: requester?.username,
    },
  });
};

/**
 * Helper: Create notification for collaboration request approved
 * @param {string} requesterId - User who requested collaboration
 * @param {string} ownerId - Project owner ID
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 */
const notifyCollabRequestApproved = async (
  requesterId,
  ownerId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername
) => {
  const owner = await User.findById(ownerId).select("name username");
  
  return createAndSendNotification({
    recipientId: requesterId,
    senderId: ownerId,
    type: "collab_request_approved",
    title: "Collaboration Request Approved",
    message: `${owner?.name || owner?.username} approved your request to join "${projectTitle}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      ownerId,
      ownerName: owner?.name,
      ownerUsername: owner?.username,
    },
  });
};

/**
 * Helper: Create notification for collaboration request rejected
 * @param {string} requesterId - User who requested collaboration
 * @param {string} ownerId - Project owner ID
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 */
const notifyCollabRequestRejected = async (
  requesterId,
  ownerId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername
) => {
  const owner = await User.findById(ownerId).select("name username");
  
  return createAndSendNotification({
    recipientId: requesterId,
    senderId: ownerId,
    type: "collab_request_rejected",
    title: "Collaboration Request Rejected",
    message: `${owner?.name || owner?.username} declined your request to join "${projectTitle}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      ownerId,
      ownerName: owner?.name,
      ownerUsername: owner?.username,
    },
  });
};

/**
 * Helper: Create notification for project liked
 * @param {string} projectOwnerId - Project owner ID
 * @param {string} likerId - User who liked the project
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 */
const notifyProjectLiked = async (
  projectOwnerId,
  likerId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername
) => {
  // Don't notify if user likes their own project
  if (projectOwnerId.toString() === likerId.toString()) {
    return null;
  }

  const liker = await User.findById(likerId).select("name username");
  
  return createAndSendNotification({
    recipientId: projectOwnerId,
    senderId: likerId,
    type: "project_liked",
    title: "Project Liked",
    message: `${liker?.name || liker?.username} liked your project "${projectTitle}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      likerId,
      likerName: liker?.name,
      likerUsername: liker?.username,
    },
  });
};

/**
 * Helper: Create notification for project commented
 * @param {string} projectOwnerId - Project owner ID
 * @param {string} commenterId - User who commented
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 * @param {string} commentContent - Comment content (truncated)
 */
const notifyProjectCommented = async (
  projectOwnerId,
  commenterId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername,
  commentContent
) => {
  // Don't notify if user comments on their own project
  if (projectOwnerId.toString() === commenterId.toString()) {
    return null;
  }

  const commenter = await User.findById(commenterId).select("name username");
  const truncatedComment = commentContent.length > 50 
    ? commentContent.substring(0, 50) + "..." 
    : commentContent;
  
  return createAndSendNotification({
    recipientId: projectOwnerId,
    senderId: commenterId,
    type: "project_commented",
    title: "New Comment on Your Project",
    message: `${commenter?.name || commenter?.username} commented on "${projectTitle}": "${truncatedComment}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      commenterId,
      commenterName: commenter?.name,
      commenterUsername: commenter?.username,
      commentContent: truncatedComment,
    },
  });
};

/**
 * Helper: Create notification for project bookmarked
 * @param {string} projectOwnerId - Project owner ID
 * @param {string} bookmarkerId - User who bookmarked
 * @param {string} projectId - Project ID
 * @param {string} projectTitle - Project title
 * @param {string} projectSlug - Project slug
 * @param {string} ownerUsername - Project owner username
 */
const notifyProjectBookmarked = async (
  projectOwnerId,
  bookmarkerId,
  projectId,
  projectTitle,
  projectSlug,
  ownerUsername
) => {
  // Don't notify if user bookmarks their own project
  if (projectOwnerId.toString() === bookmarkerId.toString()) {
    return null;
  }

  const bookmarker = await User.findById(bookmarkerId).select("name username");
  
  return createAndSendNotification({
    recipientId: projectOwnerId,
    senderId: bookmarkerId,
    type: "project_bookmarked",
    title: "Project Bookmarked",
    message: `${bookmarker?.name || bookmarker?.username} bookmarked your project "${projectTitle}"`,
    link: `/${ownerUsername}/${projectSlug}`,
    meta: {
      projectId,
      projectSlug,
      projectTitle,
      bookmarkerId,
      bookmarkerName: bookmarker?.name,
      bookmarkerUsername: bookmarker?.username,
    },
  });
};

module.exports = {
  createAndSendNotification,
  notifyCollabRequestReceived,
  notifyCollabRequestApproved,
  notifyCollabRequestRejected,
  notifyProjectLiked,
  notifyProjectCommented,
  notifyProjectBookmarked,
};

