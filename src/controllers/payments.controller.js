// src/controllers/payments.controller.js
const crypto = require("crypto");
const { createSource, createPayment } = require("../config/paymongo");
const { getUserClient } = require("../config/supabase");

const FRONTEND_URL = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")[0].trim()
  : "http://127.0.0.1:5500";

/**
 * POST /api/payments/initiate
 * Cashier (or owner) starts a GCash/Maya checkout for a given order.
 * Creates a PayMongo Source and returns the checkout_url for the
 * frontend to display as a QR code / redirect link.
 */
async function initiatePayment(req, res, next) {
  try {
    const { order_id, payment_method, amount } = req.body;

    // PayMongo uses "paymaya" as the source type; our own schema uses "maya"
    // for consistency with orders.payment_method. Translate here.
    const paymongoType = payment_method === "maya" ? "paymaya" : "gcash";

    // PayMongo amounts are in centavos.
    const amountInCentavos = Math.round(amount * 100);

    const source = await createSource({
      amount: amountInCentavos,
      type: paymongoType,
      successUrl: `${FRONTEND_URL}/payment-success.html?order_id=${order_id}`,
      failedUrl: `${FRONTEND_URL}/payment-failed.html?order_id=${order_id}`,
    });

    // Store the payment record under the CASHIER'S OWN scoped client,
    // same RLS pattern as every other write in this API.
    const { data, error } = await req.supabase
      .from("payments")
      .insert({
        order_id,
        payment_method,
        paymongo_source_id: source.id,
        status: "pending",
        amount,
        checkout_url: source.attributes.redirect.checkout_url,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies PayMongo's HMAC signature on the raw request body.
 * See: https://developers.paymongo.com/docs/securing-webhook
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("=")),
  );

  const { t: timestamp, te: testSig, li: liveSig } = parts;
  const expectedSig = testSig || liveSig; // test mode during development

  if (!timestamp || !expectedSig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const computedSig = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Timing-safe comparison — required per PayMongo's go-live checklist.
  return crypto.timingSafeEqual(
    Buffer.from(computedSig),
    Buffer.from(expectedSig),
  );
}

/**
 * POST /api/payments/webhook
 * Called directly by PayMongo — NO user JWT, NO Authorization header.
 * Security comes entirely from HMAC signature verification, not from
 * our normal `authenticate` middleware (which this route deliberately
 * does not use).
 *
 * IMPORTANT: req.rawBody must be populated by raw-body middleware
 * registered BEFORE express.json() for this specific route — see app.js.
 */
async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers["paymongo-signature"];
    const isValid = verifyWebhookSignature(
      req.rawBody,
      signature,
      process.env.PAYMONGO_WEBHOOK_SECRET,
    );

    if (!isValid) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

    const event = req.body;
    const eventType = event?.data?.attributes?.type;
    const resource = event?.data?.attributes?.data;

    // No user token exists here, so we use the anon client with no auth
    // header for the payments lookup (allowed — payments SELECT policy
    // requires a role, so this alone can't read/write without more).
    // The actual DB mutation goes through our SECURITY DEFINER RPC,
    // which runs with elevated privilege regardless of caller role.
    const { getAnonClient } = require("../config/supabase");
    const supabase = getAnonClient();

    if (eventType === "source.chargeable") {
      const sourceId = resource.id;

      // Find our payment record by the PayMongo source id.
      const { data: payment, error: findError } = await supabase
        .from("payments")
        .select("id, amount, order_id")
        .eq("paymongo_source_id", sourceId)
        .single();

      if (findError || !payment) {
        console.error("Webhook: no matching payment for source", sourceId);
        return res.status(200).json({ received: true }); // ack anyway, nothing to retry
      }

      // Source is chargeable -> actually create the Payment (captures the money)
      const paymongoPayment = await createPayment({
        amount: Math.round(payment.amount * 100),
        sourceId,
        description: `CUCCU-POS order #${payment.order_id}`,
      });

      await supabase.rpc("update_payment_status", {
        p_payment_id: payment.id,
        p_status: "chargeable",
        p_paymongo_payment_id: paymongoPayment.id,
      });
    }

    if (eventType === "payment.paid") {
      const paymongoPaymentId = resource.id;

      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("paymongo_payment_id", paymongoPaymentId)
        .single();

      if (payment) {
        await supabase.rpc("update_payment_status", {
          p_payment_id: payment.id,
          p_status: "paid",
        });
      }
    }

    if (eventType === "payment.failed") {
      const paymongoPaymentId = resource.id;

      const { data: payment } = await supabase
        .from("payments")
        .select("id")
        .eq("paymongo_payment_id", paymongoPaymentId)
        .single();

      if (payment) {
        await supabase.rpc("update_payment_status", {
          p_payment_id: payment.id,
          p_status: "failed",
        });
      }
    }

    // Always acknowledge receipt quickly — PayMongo retries if we don't 200.
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/payments/:orderId
 * Lets the frontend poll payment status for a given order while waiting
 * for the customer to authorize on their phone.
 */
async function getPaymentByOrder(req, res, next) {
  try {
    const { data, error } = await req.supabase
      .from("payments")
      .select("id, status, payment_method, amount, checkout_url, created_at")
      .eq("order_id", req.params.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiatePayment, handleWebhook, getPaymentByOrder };
