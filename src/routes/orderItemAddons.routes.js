// src/routes/orderItemAddons.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createOrderItemAddonSchema,
  updateOrderItemAddonSchema,
} = require("../schemas/orderItemAddon.schema");
const {
  listOrderItemAddons,
  getOrderItemAddon,
  createOrderItemAddon,
  updateOrderItemAddon,
  deleteOrderItemAddon,
} = require("../controllers/orderItemAddons.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listOrderItemAddons);
router.get("/:id", getOrderItemAddon);
router.post("/", validate(createOrderItemAddonSchema), createOrderItemAddon);
router.patch(
  "/:id",
  validate(updateOrderItemAddonSchema),
  updateOrderItemAddon,
);

// No cashier DELETE policy — owner only.
router.delete("/:id", requireRole("owner"), deleteOrderItemAddon);

module.exports = router;
