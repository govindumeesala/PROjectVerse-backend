const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
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
  const { name, email, password, username } = req.body;
  try {
    // Check if email exists
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.authProvider === "google") {
      throw new AppError(
        "This email is registered using Google. Please log in using that method.", 
        StatusCodes.BAD_REQUEST
      );
    }

    if (existingUser) {
      return next(new AppError("Email already exists.", StatusCodes.BAD_REQUEST));
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return next(new AppError("Username already taken.", StatusCodes.BAD_REQUEST));
    }

    const user = await User.create({ 
      name, 
      email, 
      password,
      username,
      authProvider: "local" 
    });

    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.success(StatusCodes.CREATED, "User created successfully", { user: { userId: user._id, email: user.email }, accessToken });
  } catch (err) {
    next(err);
  }
};


// Login Controller
exports.login = async (req, res, next) => {
  const { emailOrUsername, password } = req.body;
  
  try {
    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ]
    });

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

    res.success(StatusCodes.OK, "Login successful", { user: { userId: user._id, email: user.email }, accessToken });
  } catch (err) {
    next(err);
  }
};



exports.googleAuth = async (req, res, next) => {
  try {
    const { idToken, username } = req.body;
    if (!idToken) return res.status(400).json({ error: "No ID token provided" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture } = decodedToken;

    let user = await User.findOne({ email });

    // If user exists with local auth
    if (user && user.authProvider === "local") {
      throw new AppError(
        "This email is registered using Email/Password. Please log in using that method.", 
        StatusCodes.FORBIDDEN
      );
    }

    // For existing Google users, proceed with login
    if (user) {
      const accessToken = generateAccessToken({ userId: user._id });
      const refreshToken = generateRefreshToken({ userId: user._id });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.success(StatusCodes.OK, "Login successful", {
        accessToken,
        user: {
          name: user.name,
          email: user.email,
          profilePhoto: user.profilePhoto,
        },
      });
    }

    // For new users, username is required
    if (!username) {
      throw new AppError("Username is required for new users", StatusCodes.NOT_FOUND);
    }

    // Create new user with username
    user = await User.create({
      name,
      email,
      username,
      profilePhoto: picture,
      authProvider: "google",
    });

    const accessToken = generateAccessToken({ userId: user._id });
    const refreshToken = generateRefreshToken({ userId: user._id });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.success(StatusCodes.CREATED, "Account created successfully", {
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        profilePhoto: user.profilePhoto,
      },
    });
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
  res.success(StatusCodes.OK, "Logged out successfully");
};

exports.refresh = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const newAccessToken = generateAccessToken({ userId: payload.userId });

    res.success(StatusCodes.OK, "Access token refreshed successfully", { accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired refresh token" });
  }
};
