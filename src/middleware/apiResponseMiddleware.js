const { StatusCodes } = require("http-status-codes");

// Safe chalk import for CJS environments
let chalk;
try {
  chalk = require("chalk");
} catch (e) {
  // Final fallback: no-op color functions
  chalk = {
    white: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    cyan: (s) => s,
    green: (s) => s,
    gray: (s) => s,
  };
}

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

  // Unified logger (colored) with safe invocation
  res.on("finish", () => {
    let colorName = "white";
    if (res.statusCode >= 500) colorName = "red";
    else if (res.statusCode >= 400) colorName = "yellow";
    else if (res.statusCode >= 300) colorName = "cyan";
    else if (res.statusCode >= 200) colorName = "green";

    const msg = `${req.method} ${req.originalUrl} → ${res.statusCode}`;
    const fn = chalk && typeof chalk[colorName] === "function" ? chalk[colorName] : null;
    console.log(fn ? fn(msg) : msg);
  });

  next();
};

exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const red = chalk && typeof chalk.red === "function" ? chalk.red : (s) => s;
  const gray = chalk && typeof chalk.gray === "function" ? chalk.gray : (s) => s;
  console.error(red("❌ Error:"), red(err.message));
  if (err.stack) console.error(gray(err.stack));

  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
