/**
 * Auth Routes
 * Base Path: /api/auth
 * Public Routes
 */

const express = require("express");
const router = express.Router();

// Import controller methods
const {
  register,
  login
} = require("../controllers/authController");

// --------------------
// AUTH ROUTES
// --------------------

// Register new user (student/tutor)
router.post("/register", register);

// Login user
router.post("/login", login);

module.exports = router;
