Nice — good plan. Below I list the **exact API routes** you’ll need to build the Profile page UI you described, plus request/response schemas, controller names, how file uploads work, auth requirements, pagination/filters, and small implementation notes (caching, validation, security). When you implement these on the backend I can generate the frontend calls/components that consume them.

---

# API endpoints for Profile page

> Base path used below: `/api`. Protect = requires `Authorization: Bearer <accessToken>` (and server-side `protect` middleware that verifies JWT).

---

## 1) Get logged-in user profile

**GET** `/api/users/me`
**Auth:** required
**Description:** Returns profile metadata (name, email, idNumber, year, profilePhoto, summary, role, counts maybe). Use this to populate the profile header section.

**Controller:** `userController.getMe`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "647f...",
    "name": "Govind",
    "email": "a@b.com",
    "idNumber": "S12345",
    "year": "3",
    "profilePhoto": "https://res.cloudinary.com/..../image.jpg",
    "summary": "Student, ML enthusiast",
    "role": "student",
    "projectsCount": 4,           // optional (fast)
    "collaborationsCount": 7,     // optional (fast)
    "contributionsCount": 3       // optional (fast)
  }
}
```

**Notes:** compute counts server-side (aggregate). Keep these lightweight — you may compute on-demand or via separate stats endpoint (below).

---

## 2) Update logged-in user profile (including photo upload)

**PATCH** `/api/users/me`
**Auth:** required
**Content-Type:** `multipart/form-data` (for photo) OR `application/json` (if no file)
**Fields (form-data):**

* `name` (string)
* `summary` (string)
* `idNumber` (string)
* `year` (string or number)
* `profilePhoto` (file) — key name exactly `profilePhoto`

**Controller:** `userController.updateMe`

**Behaviour:** If `profilePhoto` file present, upload to Cloudinary (or your storage) and save URL in `user.profilePhoto`. Validate fields. Ensure owner only updates own profile.

**Response (200):**

```json
{ "success": true, "data": { /* updated user doc */ } }
```

**Implementation:** use `multer` memoryStorage -> `sharp` optional resizing -> cloudinary upload stream.

---

## 3) Get user analytics / stats (counts shown in card)

**GET** `/api/users/me/stats`
**Auth:** required
**Description:** Returns small analytics: number of projects owned, number of collaborations (historical), number of contributions (projects contributed to), maybe completed vs ongoing counts.

**Controller:** `userController.getMyStats`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "projectsOwned": 4,
    "projectsContributed": 3,
    "collaborationRecords": 7,      // from Collaboration collection
    "projectsCompleted": 2,
    "projectsOngoing": 2,
    "lookingForContributorsCount": 1
  }
}
```

**Implementation notes:** Use MongoDB aggregations:

* `Project.countDocuments({ owner: userId })`
* `Collaboration.countDocuments({ user: userId })`
* `Project.countDocuments({ contributors: userId })`
  You can compute all in parallel (Promise.all) or single aggregation pipeline.

---

## 4) Get projects owned by logged in user (My projects) — paginated

**GET** `/api/projects/my?limit=12&page=1&status=ongoing`
**Auth:** required
**Query params:** `limit`, `page`, optional `status`, optional `search`
**Controller:** `projectController.getMyProjects`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [ /* projects array */ ],
    "page": 1,
    "limit": 12,
    "total": 34
  }
}
```

**Implementation:** `Project.find({ owner: userId, ...(status && {status}) }).skip((page-1)*limit).limit(limit).sort({createdAt:-1})`

---

## 5) Get projects the user collaborated on (projects where user is contributor) — paginated

**GET** `/api/projects/collaborations?limit=12&page=1`
**Auth:** required
**Controller:** `projectController.getCollaboratedProjects`

**Response (200):** same shape as above.

**Implementation:** `Project.find({ contributors: userId })` with pagination. Alternatively join `Collaboration` to get richer info (startedAt, role).

---

## 6) Get user's collaboration records (optional, historical)

**GET** `/api/users/me/collaborations?limit=12&page=1`
**Auth:** required
**Controller:** `collabController.getMyCollaborations`

**Response:** array of Collaboration docs including `project`, `startedAt`, `endedAt`, `role`.

**Use:** use to display a timeline or detailed list.

---

## 7) Get another user's public profile (for viewing other profiles)

**GET** `/api/users/:userId`
**Auth:** optional (but may still require auth)
**Description:** Returns public info (name, photo, summary, counts maybe). Use to show other people's profiles.

**Controller:** `userController.getById`

---

## 8) Get notifications (for small bell on profile page or notification center)

**GET** `/api/notifications?limit=20&page=1&unreadOnly=true`
**Auth:** required
**Controller:** `notificationController.listForUser`

**Response:** list of notifications; unread counts can be returned as meta.

---

## 9) Mark notification as read / delete

**PATCH** `/api/notifications/:id/read`
**DELETE** `/api/notifications/:id`
**Auth:** required
**Controller:** `notificationController.markRead`, `notificationController.delete`

---

## 10) Misc helpful endpoints

* **GET** `/api/users/:userId/projects?limit=...` — projects for any user (public profile)
* **GET** `/api/users/me/bookmarks` — if you show bookmarks on profile
* **GET** `/api/users/me/settings` and **PATCH** `/api/users/me/settings` — if you allow personalization.

---

# Required controllers & routes file mapping (suggested)

```
/controllers/
  userController.js       // getMe, updateMe, getMyStats, getById
  projectController.js    // getMyProjects, getCollaboratedProjects
  collabController.js     // getMyCollaborations
  notificationController.js
/routes/
  userRoutes.js           // /api/users/*
  projectRoutes.js        // /api/projects/*
  collabRoutes.js         // /api/collaborations/*
  notificationRoutes.js   // /api/notifications/*
```

Example `userRoutes.js`:

```js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getMe, updateMe, getMyStats, getById } = require('../controllers/userController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();
router.get('/me', protect, getMe);
router.patch('/me', protect, upload.single('profilePhoto'), updateMe);
router.get('/me/stats', protect, getMyStats);
router.get('/:userId', protect, getById); // or public
module.exports = router;
```

---

# Request examples (Postman / frontend notes)

### Fetch profile (frontend)

```js
axios.get('/api/users/me', { headers: { Authorization: `Bearer ${accessToken}` }});
```

### Update profile with photo (frontend)

```js
const fd = new FormData();
fd.append('name', name);
fd.append('summary', summary);
fd.append('profilePhoto', fileInput.files[0]); // <input type="file" name="profilePhoto" />
await axios.patch('/api/users/me', fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }});
```

### Get stats

```js
axios.get('/api/users/me/stats', { headers: { Authorization: `Bearer ${token}` }});
```

### Get my projects (paginated)

```js
axios.get('/api/projects/my?limit=12&page=1', { headers: { Authorization: `Bearer ${token}` }});
```

---

# Implementation tips & considerations

### Auth & security

* Protect all user-specific routes with `protect` middleware that sets `req.user = { userId, email }`.
* For update routes, confirm `req.user.userId === targetUserId` (ownership).
* Validate inputs using `express-validator` or middleware (you already added validators).
* Limit uploaded file sizes (`multer` `limits: { fileSize: 2 * 1024 * 1024 }`) and accept only image MIME types.
* Sanitize strings to avoid XSS when rendering in frontend.

### File uploads

* Use `multer` memoryStorage + `sharp` to resize client images and then upload buffer to Cloudinary (stream upload). Save resulting secure URL in `user.profilePhoto` or `project.projectPhoto`.

### Performance & UX

* Use **pagination** and `limit` for project lists.
* For stats card: either compute counts on demand (fast enough for small app), or precompute periodically (cron) or increment counters on events for very large scale.
* Return minimal data for card (counts) and lazy-load full lists.

### Caching & stale UI

* Frontend uses React Query; use `staleTime` for stats (e.g., 30s) and `refetchOnWindowFocus` as desired.
* Invalidate queries after edit (e.g., after `updateMe`, invalidate `user/me`, `user/me/stats`).

### Data shapes & DTOs

* Don’t send sensitive fields (password, refresh token) in responses.
* Use DTOs to control fields returned.

### Error handling

* Return consistent error format:

```json
{ "success": false, "error": { "message": "Not authorized", "code": "UNAUTH" } }
```

---

# Example minimal SQL-like aggregation to get stats (Mongo)

```js
// projects owned
const projectsOwned = await Project.countDocuments({ owner: userId });

// collaborations (if using Collaboration model)
const collabCount = await Collaboration.countDocuments({ user: userId });

// projects contributed to (distinct projects via Collaboration or Project.contributors)
const projectsContributed = await Project.countDocuments({ contributors: userId });
```

---

# Next step

When you implement the routes/controllers above in the backend, tell me and I will:

* generate the **exact controller code** (with multer, Cloudinary upload, sharp resize) for `updateMe`, `getMyStats`, and `getMyProjects`, or
* generate the **frontend React components** that use React Query & your `authStore` to fetch and render the profile sections (header, stats card, tabs + paginated lists) matching your Tailwind / shadcn UI theme.

Which do you want to do first — backend controllers or frontend components?
