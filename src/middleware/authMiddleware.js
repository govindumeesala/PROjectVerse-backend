const jwt = require("jsonwebtoken");

const jwt_access_token_secret = process.env.ACCESS_TOKEN_SECRET;

exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, jwt_access_token_secret);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ error: "Not authorized, token failed" });
  }
};

exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, jwt_access_token_secret);
      req.user = decoded; // attach user if token is valid
    } catch (err) {
      console.warn("Optional auth: invalid token, ignoring.");
      // don’t block the request — just don’t set req.user
    }
  }

  // if no token → req.user stays undefined
  next();
};