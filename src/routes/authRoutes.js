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
router.post("/check-username", checkUsername);

module.exports = router;
