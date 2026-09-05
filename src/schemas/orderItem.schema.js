// src/schemas/orderItem.schema.js
const { z } = require("zod");

const createOrderItemSchema = z.object({
  order_id: z.number().int().positive(),
  product_variant_id: z.number().int().positive(),
  quantity: z.number().int().positive().optional().default(1),
  unit_price: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

const updateOrderItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    unit_price: z.number().nonnegative().optional(),
    subtotal: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createOrderItemSchema, updateOrderItemSchema };
