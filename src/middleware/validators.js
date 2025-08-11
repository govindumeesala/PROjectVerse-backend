// middleware/validators.js
const { body, validationResult } = require("express-validator");

const validateSignup = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("A valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateLogin = [
  body("email").isEmail().withMessage("A valid email is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()){
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

const validateUserUpdate = [
  body("year")
    .optional()
    .isString()
    .withMessage("Year must be a text"),
  body("idNumber")
    .optional()
    .isString()
    .withMessage("ID number must be text"),
  body("summary")
    .optional()
    .isString()
    .withMessage("Summary must be text"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()){
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

module.exports = { validateSignup, validateLogin, validateUserUpdate };
