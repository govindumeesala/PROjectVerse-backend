const express = require("express");
const { signup, login, googleAuth } = require("../controllers/authController");
const { validateSignup, validateLogin } = require("../middleware/validators");

const router = express.Router();

router.post("/signup", validateSignup, signup);
router.post("/login", validateLogin, login);
router.post("/google", googleAuth); // New route for Google Sign-In

module.exports = router;
