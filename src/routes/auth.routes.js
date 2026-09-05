// src/routes/auth.routes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { loginSchema, refreshSchema } = require("../schemas/auth.schema");
const {
  login,
  refresh,
  logout,
  me,
} = require("../controllers/auth.controller");

const router = express.Router();

// Strict limiter on login to blunt brute-force/credential-stuffing attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);

// These require a valid token first.
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

module.exports = router;
