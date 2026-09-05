// src/routes/profiles.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { updateProfileSchema } = require("../schemas/profile.schema");
const {
  listProfiles,
  getProfile,
  updateProfile,
} = require("../controllers/profiles.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listProfiles);
router.get("/:id", getProfile);

// Fast-fail for non-owners; RLS also independently blocks this.
router.patch(
  "/:id",
  requireRole("owner"),
  validate(updateProfileSchema),
  updateProfile,
);

module.exports = router;
