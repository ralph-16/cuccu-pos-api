// src/routes/addons.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { createAddonSchema, updateAddonSchema } = require("../schemas/addon.schema");
const {
  listAddons,
  getAddon,
  createAddon,
  updateAddon,
  deleteAddon,
} = require("../controllers/addons.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listAddons);
router.get("/:id", getAddon);

router.post("/", requireRole("owner"), validate(createAddonSchema), createAddon);
router.patch("/:id", requireRole("owner"), validate(updateAddonSchema), updateAddon);
router.delete("/:id", requireRole("owner"), deleteAddon);

module.exports = router;