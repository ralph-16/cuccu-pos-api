// src/controllers/reports.controller.js

/**
 * GET /api/reports/sales-summary
 *
 * Delegates all aggregation to the get_sales_summary Postgres function
 * (SECURITY DEFINER — see the SQL in README.md). Called through
 * req.supabase, the per-user RLS-scoped client, so the call runs as the
 * authenticated owner and no service-role/secret key is involved.
 *
 * All money values come back as JSON numbers, consistent with every other
 * money field in this API (verified against this project: PostgREST
 * serializes `numeric` as a number). The average is computed server-side
 * in SQL to full precision — rounding for display is the frontend's job.
 */
async function getSalesSummary(req, res, next) {
  try {
    const { data, error } = await req.supabase.rpc("get_sales_summary", {
      p_from_date: req.validatedQuery.from ?? null,
      p_to_date: req.validatedQuery.to ?? null,
    });

    if (error) throw error;

    // PostgREST serializes a RETURNS TABLE function as a JSON ARRAY. The
    // function guarantees exactly one row (aggregates without GROUP BY
    // always return one), so unwrap it to deliver the documented
    // single-object contract instead of a one-element array.
    const summary = Array.isArray(data) ? data[0] : data;

    if (!summary) {
      // Should be unreachable — means the function's shape changed.
      const err = new Error("get_sales_summary returned no rows.");
      err.status = 500;
      throw err;
    }

    res.status(200).json({ data: summary });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalesSummary };
