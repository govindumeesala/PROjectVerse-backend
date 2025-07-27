const User = require("../models/User");
const jwt = require("jsonwebtoken");
const admin = require("../firebaseAdmin");
const secretKey = process.env.JWT_SECRET || "secretkeyappearshere";
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    res.status(201).json({
      success: true,
      data: { userId: user._id, email: user.email, token },
    });
  } catch (err) {
    next(new Error("Error! Something went wrong during signup."));
  }
};

// Login Controller
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (user.authProvider === "google") {
      return res.status(403).json({
        success: false,
        message: "This email is registered using Google. Please log in using Google.",
      });
    }
    if (!user || !(await user.comparePassword(password))) {
      return next(new Error("Invalid credentials. Please check your details."));
    }

    
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      secretKey,
      { expiresIn: "1h" }
    );
    res.status(200).json({
      success: true,
      data: { userId: user._id, email: user.email, token },
    });
  } catch (err) {
    next(new Error("Error! Something went wrong during login."));
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
      return res.status(403).json({
        success: false,
        message: "This email was registered using Email/Password. Please log in using that method.",
      });
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

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          name: user.name,
          email: user.email,
          profilePhoto: user.profilePhoto,
        },
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
};
