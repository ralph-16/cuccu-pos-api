// src/middleware/errorHandler.js

/**
 * Centralized error handler. Controllers call next(err) on failure
 * instead of formatting responses themselves.
 *
 * Must be registered LAST in app.js, after all routes.
 */
function errorHandler(err, req, res, next) {
  console.error(err);

  // Zod validation errors (thrown by our validate middleware)
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed.",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // Postgres/PostgREST error codes surfaced by Supabase client calls
  if (err.code === "23505") {
    return res
      .status(409)
      .json({ error: "A record with this value already exists." });
  }
  if (err.code === "23503") {
    return res
      .status(409)
      .json({ error: "This action violates a related record constraint." });
  }
  if (err.code === "PGRST116") {
    // "no rows found" from .single() when the row doesn't exist / RLS hides it
    return res.status(404).json({ error: "Resource not found." });
  }
  if (
    err.code === "42501" ||
    err.message?.toLowerCase().includes("row-level security")
  ) {
    // RLS silently blocked the operation — this is the real security boundary firing
    return res
      .status(403)
      .json({ error: "You do not have permission to perform this action." });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Internal server error." : err.message;

  return res.status(status).json({ error: message });
}

module.exports = { errorHandler };
