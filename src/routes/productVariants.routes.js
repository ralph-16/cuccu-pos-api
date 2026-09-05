// src/routes/productVariants.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createProductVariantSchema,
  updateProductVariantSchema,
} = require("../schemas/productVariant.schema");
const {
  listProductVariants,
  getProductVariant,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} = require("../controllers/productVariants.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listProductVariants);
router.get("/:id", getProductVariant);

router.post(
  "/",
  requireRole("owner"),
  validate(createProductVariantSchema),
  createProductVariant,
);
router.patch(
  "/:id",
  requireRole("owner"),
  validate(updateProductVariantSchema),
  updateProductVariant,
);
router.delete("/:id", requireRole("owner"), deleteProductVariant);

module.exports = router;
