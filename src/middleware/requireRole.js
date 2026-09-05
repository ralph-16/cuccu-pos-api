// src/middleware/requireRole.js

/**
 * Express middleware factory — restricts a route to specific roles.
 * Must run AFTER `authenticate`, since it relies on req.role.
 *
 * This is a fast-fail UX layer only. The real authorization boundary
 * is Postgres RLS (see your policies using get_user_role()). Even if
 * this middleware were accidentally skipped on a route, RLS still
 * prevents cashiers from doing owner-only writes.
 *
 * Usage: router.post("/", authenticate, requireRole("owner"), controller)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({
        error: `Forbidden. This action requires one of: ${allowedRoles.join(", ")}.`,
      });
    }

    next();
  };
}

module.exports = { requireRole };
