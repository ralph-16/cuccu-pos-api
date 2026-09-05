// src/schemas/payment.schema.js
const { z } = require("zod");

const initiatePaymentSchema = z.object({
  order_id: z.number().int().positive(),
  payment_method: z.enum(["gcash", "maya"]),
  amount: z.number().positive("Amount must be greater than zero"),
});

module.exports = { initiatePaymentSchema };
