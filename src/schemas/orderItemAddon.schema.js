// src/schemas/orderItemAddon.schema.js
const { z } = require("zod");

const createOrderItemAddonSchema = z.object({
  order_item_id: z.number().int().positive(),
  addon_id: z.number().int().positive(),
  quantity: z.number().int().positive().optional().default(1),
  unit_price: z.number().nonnegative(),
});

const updateOrderItemAddonSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    unit_price: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update.",
  });

module.exports = { createOrderItemAddonSchema, updateOrderItemAddonSchema };
