// src/routes/reports.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { validateQuery } = require("../middleware/validate");
const { salesSummaryQuerySchema } = require("../schemas/report.schema");
const { getSalesSummary } = require("../controllers/reports.controller");

const router = express.Router();

// Entire reports resource is owner-only, same as inventory-transactions.
router.use(authenticate);
router.use(requireRole("owner"));

router.get(
  "/sales-summary",
  validateQuery(salesSummaryQuerySchema),
  getSalesSummary,
);

module.exports = router;
