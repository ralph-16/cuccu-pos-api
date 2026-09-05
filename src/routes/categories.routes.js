// src/routes/categories.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createCategorySchema,
  updateCategorySchema,
} = require("../schemas/category.schema");
const {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categories.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listCategories);
router.get("/:id", getCategory);

router.post(
  "/",
  requireRole("owner"),
  validate(createCategorySchema),
  createCategory,
);
router.patch(
  "/:id",
  requireRole("owner"),
  validate(updateCategorySchema),
  updateCategory,
);
router.delete("/:id", requireRole("owner"), deleteCategory);

module.exports = router;
