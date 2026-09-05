// src/schemas/recipe.schema.js
const { z } = require("zod");

const createRecipeSchema = z.object({
  product_variant_id: z.number().int().positive(),
  ingredient_id: z.number().int().positive(),
  quantity: z.number().positive("Quantity must be greater than zero"),
});

// Only quantity makes sense to update — changing product_variant_id or
// ingredient_id on an existing recipe row is really "delete and recreate",
// so we don't expose those as editable here to avoid confusing partial updates.
const updateRecipeSchema = z.object({
  quantity: z.number().positive("Quantity must be greater than zero"),
});

module.exports = { createRecipeSchema, updateRecipeSchema };