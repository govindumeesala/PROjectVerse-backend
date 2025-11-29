# 🔔 ProjectVerse Real-Time Notification System

## Overview

This document describes the real-time notification system implemented using WebSockets (Socket.IO) for ProjectVerse. The system provides instant notifications for collaboration requests, project interactions, and more.

## Architecture

### Components

1. **Notification Model** (`src/models/Notification.js`)
   - Stores notifications in MongoDB
   - Indexed for efficient queries
   - Supports multiple notification types

2. **Socket.IO Server** (`src/socket.js`)
   - Handles WebSocket connections
   - JWT-based authentication
   - User-specific rooms for targeted notifications

3. **Notification Service** (`src/services/notificationService.js`)
   - Creates notifications in database
   - Emits WebSocket events
   - Helper functions for different notification types

4. **Notification Controller** (`src/controllers/notificationController.js`)
   - REST API endpoints for fetching/managing notifications

5. **Notification Routes** (`src/routes/notificationRoute.js`)
   - Express routes for notification management

## Notification Types

- `collab_request_received` - When someone requests to join your project
- `collab_request_approved` - When your collaboration request is approved
- `collab_request_rejected` - When your collaboration request is rejected
- `project_liked` - When someone likes your project
- `project_commented` - When someone comments on your project
- `project_bookmarked` - When someone bookmarks your project (optional)
- `system` - System notifications

## API Endpoints

### GET `/api/notifications`
Get all notifications for the logged-in user.

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 20) - Items per page
- `unreadOnly` (default: false) - Filter unread only

**Response:**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

### GET `/api/notifications/unread-count`
Get count of unread notifications.

**Response:**
```json
{
  "success": true,
  "message": "Unread count retrieved",
  "data": {
    "unreadCount": 5
  }
}
```

### PATCH `/api/notifications/:id/read`
Mark a single notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notification": {
      "_id": "...",
      "read": true
    }
  }
}
```

### PATCH `/api/notifications/read-all`
Mark all notifications as read.

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 10
  }
}
```

### DELETE `/api/notifications/:id`
Delete a single notification.

### DELETE `/api/notifications/delete-all`
Delete all notifications for the logged-in user.

## WebSocket Integration

### Client Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-access-token' // JWT access token
  },
  // Or use query parameter as fallback
  query: {
    token: 'your-access-token'
  }
});

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  // Update UI, show toast, etc.
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to Socket.IO');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

### WebSocket Events

**Client → Server:**
- `ping` - Health check (server responds with `pong`)

**Server → Client:**
- `notification` - New notification received
  ```json
  {
    "_id": "...",
    "type": "project_liked",
    "title": "Project Liked",
    "message": "John Doe liked your project \"My Project\"",
    "link": "/username/project-slug",
    "meta": {...},
    "read": false,
    "createdAt": "...",
    "sender": {...}
  }
  ```

## Integration Points

Notifications are automatically sent when:

1. **Collaboration Request** (`requestToJoinProject`)
   - Sends `collab_request_received` to project owner

2. **Request Approval/Rejection** (`respondToRequest`)
   - Sends `collab_request_approved` or `collab_request_rejected` to requester

3. **Project Liked** (`likeProject`)
   - Sends `project_liked` to project owner (if not self-like)

4. **Project Commented** (`addComment`)
   - Sends `project_commented` to project owner (if not self-comment)

## Error Handling

- **Non-blocking**: Notification failures don't break main operations
- **Graceful degradation**: If WebSocket fails, notification is still saved to DB
- **Offline support**: Users receive notifications when they come online via REST API
- **Error logging**: All errors are logged for debugging

## Security

- JWT authentication required for WebSocket connections
- User-specific rooms prevent unauthorized access
- All API endpoints require authentication
- Input validation on all endpoints

## Performance

- Database indexes on `recipient`, `read`, and `createdAt`
- Lean queries for better performance
- Pagination support for large notification lists
- Efficient WebSocket room management

## Testing

### Manual Testing

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Connect a client:**
   ```javascript
   const socket = io('http://localhost:3000', {
     auth: { token: 'your-jwt-token' }
   });
   ```

3. **Trigger a notification:**
   - Like a project
   - Comment on a project
   - Request collaboration
   - Approve/reject a request

4. **Verify:**
   - Notification appears in database
   - WebSocket event is received (if user online)
   - REST API returns notification

## Environment Variables

Add to `.env`:
```env
FRONTEND_URL=http://localhost:5173  # For CORS configuration
ACCESS_TOKEN_SECRET=your-secret     # For JWT verification
```

## Installation

1. Install dependencies:
   ```bash
   npm install socket.io
   ```

2. The system is automatically initialized when the server starts.

## Future Enhancements

- [ ] Notification preferences (user can disable certain types)
- [ ] Email notifications for important events
- [ ] Push notifications for mobile
- [ ] Notification grouping (e.g., "5 people liked your project")
- [ ] Real-time notification count updates

