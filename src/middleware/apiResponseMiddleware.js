const { StatusCodes } = require("http-status-codes");

exports.successHandler = (req, res, next) => {
  res.success = (
    data = null, // Default to null if not provided
    message = "Success",
    statusCode = StatusCodes.OK
  ) => {
    res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null, // Ensure data is never undefined
    });
  };
  next();
};

exports.errorHandler = (err, req, res) => {
  console.log(req.method, req.url);
  console.error(err.stack);
  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};