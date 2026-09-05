// src/schemas/profile.schema.js
const { z } = require("zod");

// Only owners can edit profiles (per RLS), and only full_name/role make sense to change.
// id is never editable — it's tied 1:1 to auth.users.id.
const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150).optional(),
    role: z.enum(["owner", "cashier"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { updateProfileSchema };
