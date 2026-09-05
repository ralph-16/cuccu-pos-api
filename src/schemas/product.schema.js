// src/schemas/product.schema.js
const { z } = require("zod");

const createProductSchema = z.object({
  category_id: z.number().int().positive(),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  is_available: z.boolean().optional().default(true),
});

// All fields optional for partial updates, but at least one must be present.
const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createProductSchema, updateProductSchema };
