// src/middleware/pagination.js
const { StatusCodes } = require("http-status-codes");

/**
 * Common pagination middleware factory.
 * Usage: pagination(defaultLimit = 10, maxLimit = 100)
 * Returns an express middleware that sets req.paging = { page, limit, skip, filters, rawQuery }
 */
module.exports = (defaultLimit = 3, maxLimit = 100) => {
  return (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      let limit = Math.max(1, parseInt(req.query.limit || String(defaultLimit), 10));
      limit = Math.min(limit, maxLimit);
      const skip = (page - 1) * limit;

      const filters = {};

      // status filter (completed/ongoing)
      if (req.query.status && ["completed", "ongoing"].includes(req.query.status)) {
        filters.status = req.query.status;
      }

      // generic search across title, description, techStack
      const search = (req.query.search || "").trim();
      if (search) {
        const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(safe, "i");
        filters.$or = [
          { title: regex },
          { description: regex },
          { techStack: regex },
        ];
      }

      req.paging = {
        page,
        limit,
        skip,
        filters,
        rawQuery: req.query,
      };

      return next();
    } catch (err) {
        console.error("Pagination Middleware Error:", err);
    return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Invalid pagination params",
    });
    }
  };
};
