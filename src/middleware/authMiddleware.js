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
    res.status(401).json({ error: "Not authorized, token failed" });
  }
};
