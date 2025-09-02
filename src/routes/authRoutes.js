const express = require("express");
const { signup, login, googleAuth, logout, refresh } = require("../controllers/authController");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth); 
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/check-username", async (req, res, next) => {
  const { username } = req.body;
  try {
    const exists = await User.findOne({ username });
    res.success(StatusCodes.OK, "Username availability checked", { 
      available: !exists 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
