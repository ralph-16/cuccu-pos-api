// src/schemas/order.schema.js
const { z } = require("zod");

const createOrderSchema = z.object({
  order_status: z
    .enum(["pending", "preparing", "completed", "cancelled"])
    .optional()
    .default("pending"),
  payment_method: z.enum(["cash", "gcash", "maya"]),
  subtotal: z.number().nonnegative().optional().default(0),
  discount_amount: z.number().nonnegative().optional().default(0),
  total_amount: z.number().nonnegative().optional().default(0),
});

const updateOrderSchema = z
  .object({
    order_status: z
      .enum(["pending", "preparing", "completed", "cancelled"])
      .optional(),
    payment_method: z.enum(["cash", "gcash", "maya"]).optional(),
    subtotal: z.number().nonnegative().optional(),
    discount_amount: z.number().nonnegative().optional(),
    total_amount: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createOrderSchema, updateOrderSchema };
