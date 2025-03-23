const User = require("../models/User");
const jwt = require("jsonwebtoken");

const secretKey = process.env.JWT_SECRET || "secretkeyappearshere";

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

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
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
