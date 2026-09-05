// src/routes/products.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createProductSchema,
  updateProductSchema,
} = require("../schemas/product.schema");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/products.controller");

const router = express.Router();

// Every route requires a logged-in user.
router.use(authenticate);

router.get("/", listProducts);
router.get("/:id", getProduct);

// Fast-fail: reject cashiers before hitting the DB. RLS enforces this too.
router.post(
  "/",
  requireRole("owner"),
  validate(createProductSchema),
  createProduct,
);
router.patch(
  "/:id",
  requireRole("owner"),
  validate(updateProductSchema),
  updateProduct,
);
router.delete("/:id", requireRole("owner"), deleteProduct);

module.exports = router;
