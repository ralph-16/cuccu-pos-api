// src/schemas/ingredient.schema.js
const { z } = require("zod");

const createIngredientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  stock_quantity: z
    .number()
    .nonnegative("Stock quantity must be zero or positive")
    .optional()
    .default(0),
  reorder_level: z
    .number()
    .nonnegative("Reorder level must be zero or positive")
    .optional()
    .default(0),
  is_available: z.boolean().optional().default(true),
});

const updateIngredientSchema = createIngredientSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createIngredientSchema, updateIngredientSchema };
