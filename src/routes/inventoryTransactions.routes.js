// src/routes/inventoryTransactions.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validate } = require("../middleware/validate");
const {
  createInventoryTransactionSchema,
} = require("../schemas/inventoryTransaction.schema");
const {
  listInventoryTransactions,
  getInventoryTransaction,
  createInventoryTransaction,
  deleteInventoryTransaction,
} = require("../controllers/inventoryTransactions.controller");

const router = express.Router();

router.use(authenticate);
router.use(requireRole("owner")); // entire resource is owner-only, reads included

router.get("/", listInventoryTransactions);
router.get("/:id", getInventoryTransaction);
router.post(
  "/",
  validate(createInventoryTransactionSchema),
  createInventoryTransaction,
);
router.delete("/:id", deleteInventoryTransaction);

module.exports = router;
