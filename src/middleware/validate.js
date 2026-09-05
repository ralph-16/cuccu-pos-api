// src/middleware/validate.js

/**
 * Express middleware factory — validates req.body against a zod schema.
 * On success, replaces req.body with the parsed (and type-coerced) data.
 * On failure, throws a ZodError which errorHandler.js formats into a 400.
 *
 * Usage: router.post("/", authenticate, validate(createProductSchema), controller)
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err); // caught by errorHandler.js (ZodError branch)
    }
  };
}

module.exports = { validate };