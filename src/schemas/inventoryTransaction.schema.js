// src/schemas/inventoryTransaction.schema.js
const { z } = require("zod");

const createInventoryTransactionSchema = z.object({
  ingredient_id: z.number().int().positive(),
  transaction_type: z.enum(["stock_in", "stock_out", "adjustment"]),
  quantity: z.number().positive("Quantity must be greater than zero"),
  reference_type: z.string().trim().max(50).optional().nullable(),
  reference_id: z.number().int().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

// Transactions are a ledger — they represent history, so we intentionally
// do NOT expose an update endpoint. Correcting a mistake should be a new
// "adjustment" entry, not editing the past record. Only create + read + delete
// (delete only for the rare case of a genuine data-entry error).
module.exports = { createInventoryTransactionSchema };
