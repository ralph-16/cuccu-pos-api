// src/routes/recipes.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createRecipeSchema,
  updateRecipeSchema,
} = require("../schemas/recipe.schema");
const {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} = require("../controllers/recipes.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listRecipes);
router.get("/:id", getRecipe);

router.post(
  "/",
  requireRole("owner"),
  validate(createRecipeSchema),
  createRecipe,
);
router.patch(
  "/:id",
  requireRole("owner"),
  validate(updateRecipeSchema),
  updateRecipe,
);
router.delete("/:id", requireRole("owner"), deleteRecipe);

module.exports = router;
