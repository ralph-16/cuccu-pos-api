// src/schemas/addon.schema.js
const { z } = require("zod");

const createAddonSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  price: z.number().nonnegative("Price must be zero or positive"),
  is_available: z.boolean().optional().default(true),
});

const updateAddonSchema = createAddonSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createAddonSchema, updateAddonSchema };
