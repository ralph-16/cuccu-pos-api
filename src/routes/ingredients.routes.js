// src/routes/ingredients.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createIngredientSchema,
  updateIngredientSchema,
} = require("../schemas/ingredient.schema");
const {
  listIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} = require("../controllers/ingredients.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listIngredients);
router.get("/:id", getIngredient);

router.post("/", requireRole("owner"), validate(createIngredientSchema), createIngredient);
router.patch("/:id", requireRole("owner"), validate(updateIngredientSchema), updateIngredient);
router.delete("/:id", requireRole("owner"), deleteIngredient);

module.exports = router;