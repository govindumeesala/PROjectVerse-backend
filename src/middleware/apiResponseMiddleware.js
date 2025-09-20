const { StatusCodes } = require("http-status-codes");

let chalk;
(async () => {
  chalk = (await import("chalk")).default;
})();

exports.successHandler = (req, res, next) => {
  res.success = (
    statusCode = StatusCodes.OK,
    message = "Success",
    data = null
  ) => {
    res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
    });
  };

  // Unified logger (colored)
  res.on("finish", () => {
    let color = chalk.white;
    if (res.statusCode >= 500) color = chalk.red;
    else if (res.statusCode >= 400) color = chalk.yellow;
    else if (res.statusCode >= 300) color = chalk.cyan;
    else if (res.statusCode >= 200) color = chalk.green;

    console.log(
      color(`${req.method} ${req.originalUrl} → ${res.statusCode}`)
    );
  });

  next();
};

exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(chalk.red("❌ Error:"), chalk.red(err.message));
  console.error(chalk.gray(err.stack));

  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
