// src/routes/orders.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createOrderSchema,
  updateOrderSchema,
} = require("../schemas/order.schema");
const {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
} = require("../controllers/orders.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", listOrders);
router.get("/:id", getOrder);
router.post("/", validate(createOrderSchema), createOrder);
router.patch("/:id", validate(updateOrderSchema), updateOrder);

// Only owners can delete orders — no cashier DELETE policy exists in RLS.
router.delete("/:id", requireRole("owner"), deleteOrder);

module.exports = router;
