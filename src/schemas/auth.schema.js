// src/schemas/auth.schema.js
const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "refresh_token is required"),
});

module.exports = { loginSchema, refreshSchema };
