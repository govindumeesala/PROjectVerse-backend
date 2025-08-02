const User = require("../models/User");
const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const AppError = require("../utils/AppError");

const jwt_access_token_secret = process.env.ACCESS_TOKEN_SECRET;
const jwt_refresh_token_secret = process.env.REFRESH_TOKEN_SECRET;

const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwt_access_token_secret, { expiresIn: "30m" });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwt_refresh_token_secret, { expiresIn: "7d" });
};


// Signup Controller
exports.signup = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.authProvider === "google") {
      throw new AppError("This email is registered using Google. Please log in using that method.", 400);
    }

    if (existingUser) {
      return next(new AppError("User already exists.", 400));
    }

    const user = await User.create({ name, email, password });

    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.success({ user: { userId: user._id, email: user.email }, accessToken }, "User created successfully");
  } catch (err) {
    next(new AppError("Error! Something went wrong during signup."));
  }
};


// Login Controller
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError("Invalid credentials.", 401));
    }

    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.success({ user: { userId: user._id, email: user.email }, accessToken }, "Login successful");
  } catch (err) {
    next(err);
  }
};



exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "No ID token provided" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture } = decodedToken;

    let user = await User.findOne({ email });

    // If user exists and was created with local signup
    if (user && user.authProvider === "local") {
      throw new AppError("This email is registered using Email/Password. Please log in using that method.", 400);
    }

    // If user doesn't exist, create one
    if (!user) {
      user = await User.create({
        name,
        email,
        profilePhoto: picture,
        authProvider: "google",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });
  

    // Send refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const data = {
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        profilePhoto: user.profilePhoto,
      },
    };

    res.success(data, "Google authentication successful");
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.success({}, "Logged out successfully");
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const newAccessToken = generateAccessToken({ userId: payload.userId });

    res.success({ accessToken: newAccessToken }, "Access token refreshed successfully");
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};
