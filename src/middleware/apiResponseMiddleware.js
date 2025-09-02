const { StatusCodes } = require("http-status-codes");

exports.successHandler = (req, res, next) => {
  res.success = (
    statusCode = StatusCodes.OK,
    message = "Success",
    data = null, // Default to null if not provided
  ) => {
    res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null, // Ensure data is never undefined
    });
  };

  console.log(req.method, req.url, res.statusCode);

  next();
};

exports.errorHandler = (err, req, res,next) => {
  console.log(req.method, req.url);
  console.error(err.stack);
  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};