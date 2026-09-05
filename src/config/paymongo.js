// src/config/paymongo.js
require("dotenv").config();

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

if (!PAYMONGO_SECRET_KEY) {
  throw new Error("Missing PAYMONGO_SECRET_KEY in environment variables.");
}

// PayMongo uses HTTP Basic Auth: secret key as username, blank password.
// This must never be used in any client-facing code — server-side only.
const AUTH_HEADER = `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64")}`;

/**
 * Creates a PayMongo Source for GCash or Maya (e-wallet payments).
 * amount must be in centavos (e.g. ₱150.00 -> 15000), per PayMongo's API.
 * successUrl/failedUrl are where PayMongo redirects the customer's browser
 * after they authorize/cancel on their banking app.
 */
async function createSource({ amount, type, successUrl, failedUrl }) {
  const res = await fetch(`${PAYMONGO_API_BASE}/sources`, {
    method: "POST",
    headers: {
      Authorization: AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount,
          type, // "gcash" or "paymaya"
          currency: "PHP",
          redirect: {
            success: successUrl,
            failed: failedUrl,
          },
        },
      },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    const message =
      json?.errors?.[0]?.detail || "PayMongo source creation failed.";
    const err = new Error(message);
    err.status = 502; // upstream provider error, not our validation error
    throw err;
  }

  return json.data;
}

/**
 * Creates a Payment against a source that has become "chargeable"
 * (i.e. the customer has authorized in their GCash/Maya app).
 * This is the step that actually captures the money.
 */
async function createPayment({ amount, sourceId, description }) {
  const res = await fetch(`${PAYMONGO_API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: AUTH_HEADER,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount,
          currency: "PHP",
          description: description || "CUCCU-POS order payment",
          source: {
            id: sourceId,
            type: "source",
          },
        },
      },
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    const message =
      json?.errors?.[0]?.detail || "PayMongo payment creation failed.";
    const err = new Error(message);
    err.status = 502;
    throw err;
  }

  return json.data;
}

module.exports = { createSource, createPayment };
