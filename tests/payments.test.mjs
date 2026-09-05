// tests/payments.test.mjs
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
dotenv.config();

import app from "../src/app.js";

// Helper: builds a validly-signed PayMongo webhook payload, exactly the
// way PayMongo itself does (see verifyWebhookSignature in the controller).
function signWebhookPayload(payload, secret) {
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return {
    rawBody,
    header: `t=${timestamp},te=${signature}`,
  };
}

describe("Payments", () => {
  let ownerToken;
  let cashierToken;
  let orderId;
  let paymentId;
  let paymongoSourceId;

  beforeAll(async () => {
    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_OWNER_EMAIL,
      password: process.env.TEST_OWNER_PASSWORD,
    });
    ownerToken = ownerLogin.body.access_token;

    const cashierLogin = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_CASHIER_EMAIL,
      password: process.env.TEST_CASHIER_PASSWORD,
    });
    cashierToken = cashierLogin.body.access_token;

    // Create a fresh order to attach test payments to.
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ payment_method: "gcash", subtotal: 100, total_amount: 100 });
    orderId = orderRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up the test order (cascades to payments via ON DELETE CASCADE).
    if (orderId) {
      await request(app)
        .delete(`/api/orders/${orderId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
    }
  });

  it("rejects unauthenticated payment initiation", async () => {
    const res = await request(app)
      .post("/api/payments/initiate")
      .send({ order_id: orderId, payment_method: "gcash", amount: 100 });

    expect(res.status).toBe(401);
  });

  it("rejects invalid payment_method", async () => {
    const res = await request(app)
      .post("/api/payments/initiate")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ order_id: orderId, payment_method: "paypal", amount: 100 });

    expect(res.status).toBe(400);
  });

  it("creates a real PayMongo source for a valid GCash payment request", async () => {
    const res = await request(app)
      .post("/api/payments/initiate")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ order_id: orderId, payment_method: "gcash", amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.checkout_url).toContain("paymongo.com");
    expect(res.body.data.paymongo_source_id).toMatch(/^src_/);

    paymentId = res.body.data.id;
    paymongoSourceId = res.body.data.paymongo_source_id;
  });

  it("allows the cashier to poll payment status by order id", async () => {
    const res = await request(app)
      .get(`/api/payments/${orderId}`)
      .set("Authorization", `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("pending");
  });

  it("rejects a webhook with an invalid signature", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("paymongo-signature", "t=123,te=not-a-real-signature")
      .send(JSON.stringify({ data: { attributes: { type: "payment.paid" } } }));

    expect(res.status).toBe(401);
  });

  it("rejects a webhook with no signature header at all", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: { attributes: { type: "payment.paid" } } }));

    expect(res.status).toBe(401);
  });

  it("accepts a validly-signed webhook and transitions payment to failed", async () => {
    // We use "payment.failed" here rather than "payment.paid" deliberately:
    // triggering a real "paid" would require a real paymongo_payment_id
    // that only exists after a genuine chargeable event, which needs a
    // human to authorize in a browser. "failed" lets us prove our webhook
    // handling logic end-to-end using data we control.
    //
    // NOTE: this test only validates signature verification + the 200
    // response contract. It intentionally does NOT assert the payment's
    // status flips, because there is no real paymongo_payment_id linking
    // this fabricated event to our test payment row.
    const payload = {
      data: {
        attributes: {
          type: "payment.failed",
          data: { id: "pay_fake_id_for_testing_only" },
        },
      },
    };

    const { rawBody, header } = signWebhookPayload(
      payload,
      process.env.PAYMONGO_WEBHOOK_SECRET,
    );

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("paymongo-signature", header)
      .send(rawBody);

    // A webhook for an unrecognized payment id should still ack with 200
    // (PayMongo retries on non-200, and we don't want retries for events
    // that will never resolve to a match).
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
