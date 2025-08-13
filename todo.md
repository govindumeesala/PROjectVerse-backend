# TODO:
1. add guard in sign up route to prevent duplicate email registration - done

Nice — here’s a clear, prioritized **TODO checklist** (backend → frontend → QA → extras) you can follow to finish the Profile page (private + public) including **My Projects / Collaborated / Bookmarks** tabs. Each item includes what to implement, why, and small notes about payloads/behavior so you can just pick and work.

# Plan & TODOs (in order)

---

## A — Prerequisites (do these first)

1. **Confirm auth & middleware**

   * `protect` middleware must populate `req.user = { userId, email }`.
   * Ensure refresh/access token flow is stable (we already discussed).
2. **Cloudinary (or storage) ready**

   * Environment variables set, account tested.
3. **Multer & sharp installed**

   * `multer` (memoryStorage) to accept uploads, `sharp` to resize images.

---

## B — Backend (implement in this order)

Make these endpoints robust first — the frontend consumes them.

1. **GET `/api/users/me`** — `userController.getMe`

   * Returns user profile fields: `_id, name, email, idNumber, year, profilePhoto, summary, role`.
   * Also include simple counts if cheap: `projectsCount`, `collaborationsCount`, `contributionsCount`, `bookmarksCount`.
   * Response shape:

     ```json
     { "success": true, "data": { /* fields + counts */ } }
     ```
2. **PATCH `/api/users/me`** — `userController.updateMe`

   * Accept `multipart/form-data` (field `profilePhoto` optional).
   * Use `multer` memory storage -> `sharp` resize -> upload to Cloudinary -> save URL in `user.profilePhoto`.
   * Validate input and only allow owner to update.
   * Return updated user DTO.
   * Postman test: send `form-data` with text fields + file.
3. **GET `/api/users/me/stats`** — `userController.getMyStats`

   * Compute counts via `countDocuments` / aggregations:

     * `projectsOwned`, `projectsContributed` (`Project.contributors`), `collaborationRecords` (if Collaboration model used), `projectsCompleted`, etc.
   * Return a small JSON object used for analytics card.
4. **GET `/api/projects/my`** — `projectController.getMyProjects`

   * Query params: `page`, `limit`, `status`, `search`.
   * Paginated response with `items`, `total`, `page`, `limit`.
5. **GET `/api/projects/collaborated`** — `projectController.getCollaboratedProjects`

   * Projects where `contributors` includes userId (or join `Collaboration`).
   * Same pagination and filters as above.
6. **GET `/api/users/me/bookmarks`** — `userController.getBookmarks`

   * Return bookmarked projects (paginated).
7. **POST `/api/users/me/bookmarks/:projectId`** and **DELETE `/api/users/me/bookmarks/:projectId`**

   * Add/remove project id to `user.bookmarks` using `$addToSet` / `$pull`.
   * Return updated bookmarks or success status.
8. **GET `/api/users/:userId`** — `userController.getById` (public profile)

   * Return public fields + public projects + public stats (no sensitive info).
   * Include `isBookmarked` or `isFollowing` if useful.
9. **GET `/api/users/:userId/projects`** — projects for public profiles (paginated)

   * Same shape as internal projects endpoint.
10. **Optional:** GET `/api/users/me/collaborations` — history (if using Collaboration model)
11. **Implement notifications endpoint** (if not already)

* `GET /api/notifications` (paginated), `PATCH /api/notifications/:id/read`.

**Backend notes**

* Protect relevant routes with `protect`.
* Use `multer` to parse `profilePhoto` and `sharp` to preprocess images before upload (resize & compress).
* Keep responses consistent (`{ success, data, message }`).
* Validate inputs (express-validator or Zod server-side).
* If you update `Project.contributors`/`User.projects` on approval/creation, make sure controllers maintain consistency (consider transactions for multi-doc ops).

---

## C — Frontend (after backend is available)

Implement hooks and components in this order — use React Query + your `authStore` + `api` axios instance.

1. **API hooks (React Query)**

   * `useGetMyProfile()` → GET `/api/users/me`
   * `useUpdateMyProfile()` → PATCH `/api/users/me` (multipart/form-data; use `mutateAsync`)
   * `useGetMyStats()` → GET `/api/users/me/stats`
   * `useGetMyProjects({page,limit,status,search})` → GET `/api/projects/my`
   * `useGetCollaboratedProjects(...)` → GET `/api/projects/collaborated`
   * `useGetBookmarks()` → GET `/api/users/me/bookmarks`
   * `useToggleBookmark(projectId)` → POST/DELETE
   * `useGetUserPublic(userId)` & `useGetUserProjects(userId)` → public profile
   * Hook behavior:

     * Attach `Authorization` header from `authStore` if access token exists or use axios instance that does it.
     * Provide `isLoading`, `isError`, `data`, `refetch`, and `mutateAsync` where relevant.
2. **Components & layout**

   * `ProfilePage` container that queries `useGetMyProfile()` and `useGetMyStats()` and renders:

     1. **Top navbar** (existing component)
     2. **ProfileHeader** component:

        * Circular profile photo (if none, show skeleton/avatar).
        * Name, email, idNumber, year, summary.
        * Edit button (opens a modal or toggles editable form).
     3. **StatsCard** component:

        * Big numbers: `projectsOwned`, `collaborationsCount`, `contributionsCount`, `bookmarksCount`.
        * Maybe small chart or progress bars (optional).
     4. **Tabs** component (shadcn/ui Tabs):

        * Tabs: `My Projects`, `Collaborated`, `Bookmarks`
        * Each tab loads corresponding list via React Query (lazy load on first open).
     5. **ProjectList** (reusable) + **ProjectCard** components (show image, title, status, owner, small actions: open, bookmark, request to join).
     6. **Pagination** component to move pages.
     7. **Footer** (existing).
   * `ProfileEditModal`:

     * Form uses `react-hook-form` + `zod` for client-side validation.
     * Includes file input for profile photo → build `FormData`, call `useUpdateMyProfile()`.
     * Show preview of selected image and cropping/resizing suggestion (optional).
3. **Public Profile**

   * `PublicProfilePage` similar to ProfilePage but uses `useGetUserPublic(userId)` and `useGetUserProjects(userId)`; hide edit actions and show only public info.
4. **UX polish**

   * Skeleton loaders for header, stats, lists.
   * Toasts for success/error (sonner).
   * Accessibility: alt text for images, keyboard-friendly tabs, aria labels.
   * Responsive layout: header stack on mobile, stats card collapses.
5. **Optimistic UI**

   * For bookmarks: optimistic update in React Query (update cache on mutate).
6. **Invalidate & refresh**

   * After profile update, invalidate `user/me`, `user/me/stats`, `projects/my` queries.
   * After bookmark toggle, invalidate bookmark queries and projects query.

---

## D — Testing & QA (must do)

1. **Postman tests** (backend):

   * `GET /api/users/me` (with bearer token)
   * `PATCH /api/users/me` — test `form-data` with `profilePhoto` (file) and text fields.
   * `GET /api/users/me/stats`
   * `GET /api/projects/my` (pagination) and `GET /api/projects/collaborated`
   * Bookmark add/remove
   * Public profile `GET /api/users/:id`
2. **Frontend tests**

   * Manual: create user, upload profile photo, create project, add collaborator, bookmark, check counts update.
   * Unit: test `ProfileHeader`, `StatsCard`, `Tabs` components.
3. **Edge cases**

   * No profile photo (show skeleton).
   * No projects (empty state illustration).
   * API errors (show user-friendly message & retry).
4. **Security checks**

   * Verify users cannot update other users (`PATCH /api/users/:id` must be forbidden unless admin).
   * Validate file size/type (max 2MB, mime `image/*`) on frontend and backend.
5. **Performance**

   * Ensure paginated endpoints return `limit` items; check slow queries with aggregation.
6. **Mobile testing**

   * Verify responsive layout: header stacks, tabs usable, lists scroll properly.

---

## E — Deployment & monitoring (optional)

1. Add logging on backend for key endpoints (profile update, image upload).
2. Monitor Cloudinary usage & set limits.
3. On production, use HTTPS and set cookie flags: `sameSite='none'`, `secure=true` if cross-domain.
4. If worried about DB reads for counts, create a lightweight stat cache / counters on project create/approve for faster reads.

---

## F — Minimal Postman example payloads

* **PATCH `/api/users/me`** (multipart/form-data)

  * `name`: `Govind`
  * `summary`: `ML student`
  * `profilePhoto`: (file)
* **GET `/api/users/me`**

  * Header: `Authorization: Bearer <accessToken>`
* **GET `/api/projects/my?page=1&limit=8`**

  * Header: `Authorization: Bearer <accessToken>`
* **POST `/api/users/me/bookmarks/:projectId`**

  * Header: `Authorization: Bearer <accessToken>`

---

## G — Small dev checklist to follow (TL;DR)

1. Implement backend endpoints (me, updateMe, stats, my-projects, collaborated, bookmarks, public profile).
2. Test backend with Postman (file uploads, pagination, auth).
3. Add frontend API hooks (React Query) for each endpoint.
4. Build `ProfileHeader`, `StatsCard`, `Tabs` + `ProjectList` components.
5. Wire edit modal (file input → FormData) + optimistic bookmark logic.
6. QA: manual flows + error handling + mobile/responsive testing.
7. Polish: skeletons, toasts, accessibility, caching.

---

If you want I can now:

* generate **exact route + controller code** for `GET /api/users/me`, `PATCH /api/users/me` (with multer + sharp + cloudinary) and `GET /api/users/me/stats`; **or**
* generate the **frontend React Query hooks + ProfilePage / ProfileHeader / StatsCard components** (with shadcn/ui + Tailwind) that call the endpoints above.

Which do you want me to produce first?
