// src/schemas/report.schema.js
const { z } = require("zod");

// A YYYY-MM-DD string that is also a REAL calendar date (rejects e.g.
// 2026-02-30). The round-trip check is what catches impossible dates that
// would otherwise surface later as a raw Postgres error instead of a 400.
const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date in YYYY-MM-DD format.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Must be a real calendar date (e.g. not 2026-02-30).");

// GET /api/reports/sales-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Both params optional; when omitted the database function defaults the
// range to "today" in the cafe's business timezone (Asia/Manila — see
// the get_sales_summary SQL function for the full explanation).
const salesSummaryQuerySchema = z
  .object({
    from: dateOnlyString.optional(),
    to: dateOnlyString.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "'to' must be on or after 'from'.",
  });

module.exports = { salesSummaryQuerySchema };
