exports.successHandler = (req, res, next) => {
  res.success = (data, message = "Success") => {
    res.status(200).json({ success: true, message, data });
  };
  next();
};

exports.errorHandler = (err, req, res, next) => {
  console.log(req.method, req.url);
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};