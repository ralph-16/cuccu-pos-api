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
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSalesSummary };
