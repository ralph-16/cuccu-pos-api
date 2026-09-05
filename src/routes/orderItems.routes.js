// src/routes/orderItems.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const { createOrderItemSchema, updateOrderItemSchema } = require("../schemas/orderItem.schema");
const {
  listOrderItems,
  getOrderItem,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
} = require("../controllers/orderItems.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listOrderItems);
router.get("/:id", getOrderItem);
router.post("/", validate(createOrderItemSchema), createOrderItem);
router.patch("/:id", validate(updateOrderItemSchema), updateOrderItem);

// No cashier DELETE policy on order_items in RLS — owner only.
router.delete("/:id", requireRole("owner"), deleteOrderItem);

module.exports = router;