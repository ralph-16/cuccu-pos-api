// src/schemas/productVariant.schema.js
const { z } = require("zod");

const createProductVariantSchema = z.object({
  product_id: z.number().int().positive(),
  variant_name: z.string().trim().min(1, "Variant name is required").max(100),
  size: z.string().trim().max(50).optional().nullable(),
  temperature: z.string().trim().max(20).optional().nullable(),
  price: z.number().nonnegative("Price must be zero or positive"),
  is_available: z.boolean().optional().default(true),
});

const updateProductVariantSchema = createProductVariantSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createProductVariantSchema, updateProductVariantSchema };