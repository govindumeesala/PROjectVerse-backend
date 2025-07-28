const User = require("../models/User");
const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const secretKey = process.env.JWT_SECRET;
const AppError = require("../utils/AppError");

// Signup Controller
exports.signup = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    const user = await User.create({ name, email, password });
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      secretKey,
      { expiresIn: "1h" }
    );

    res.success({ userId: user._id, email: user.email, token }, "User created successfully");
  } catch (err) {
    next(new Error("Error! Something went wrong during signup."));
  }
};

// Login Controller
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      await bcrypt.compare(password, "$2b$10$invalidsaltinvalidsaltinv");
      return next(new AppError("Invalid credentials. Please check your details.", 401));
    }

    if (user.authProvider === "google") {
      return next(new AppError("This email is registered using Google. Please log in using Google.", 400));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError("Invalid credentials. Please check your details.", 401));
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT secret not set in environment variables");
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.success({ userId: user._id, email: user.email, token }, "Login successful");
  } catch (err) {
    next(err);
  }
};


exports.googleAuth = async (req, res) => {
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

    if (!user) {
      user = await User.create({
        name,
        email,
        profilePhoto: picture,
        authProvider: "google",
      });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const data = {
      token,
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
