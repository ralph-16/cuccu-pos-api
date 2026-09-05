// src/routes/payments.routes.js
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { initiatePaymentSchema } = require("../schemas/payment.schema");
const {
  initiatePayment,
  handleWebhook,
  getPaymentByOrder,
} = require("../controllers/payments.controller");

const router = express.Router();

// Webhook is PayMongo calling us directly — NO authenticate middleware.
// Security is HMAC signature verification inside the controller itself.
router.post("/webhook", handleWebhook);

// Everything else requires a normal logged-in cashier/owner.
router.use(authenticate);

router.post("/initiate", validate(initiatePaymentSchema), initiatePayment);
router.get("/:orderId", getPaymentByOrder);

module.exports = router;
