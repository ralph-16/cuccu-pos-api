// tests/reports.test.mjs
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
dotenv.config();

import app from "../src/app.js";

// "Today" in the business timezone (Asia/Manila), formatted YYYY-MM-DD —
// must match how the get_sales_summary SQL function defines its default
// range, or the delta assertions below would compare different windows.
function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

describe("Reports: sales summary", () => {
  let ownerToken;
  let cashierToken;
  let createdOrderIds = [];

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
  });

  afterAll(async () => {
    // Clean up every order this suite created, so re-running tests doesn't
    // leave junk data behind in the real Supabase project.
    for (const id of createdOrderIds) {
      await request(app)
        .delete(`/api/orders/${id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
    }
  });

  async function createOrder(paymentMethod, totalAmount) {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        payment_method: paymentMethod,
        subtotal: totalAmount,
        total_amount: totalAmount,
      });

    if (res.status === 201) {
      createdOrderIds.push(res.body.data.id);
    }
    return res;
  }

  async function completeOrder(id) {
    return request(app)
      .patch(`/api/orders/${id}`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ order_status: "completed" });
  }

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/reports/sales-summary");
    expect(res.status).toBe(401);
  });

  it("blocks cashiers (owner-only resource, fast-fail before RLS)", async () => {
    const res = await request(app)
      .get("/api/reports/sales-summary")
      .set("Authorization", `Bearer ${cashierToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects invalid query params (bad date format / from > to)", async () => {
    const badFormat = await request(app)
      .get("/api/reports/sales-summary")
      .query({ from: "not-a-date" })
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(badFormat.status).toBe(400);

    const badOrder = await request(app)
      .get("/api/reports/sales-summary")
      .query({ from: "2026-01-10", to: "2026-01-01" })
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(badOrder.status).toBe(400);
  });

  it("aggregates completed orders only, for the requested range", async () => {
    // Baseline BEFORE creating anything, so assertions are deltas and
    // pre-existing data in the project cannot make them flaky.
    const range = { from: manilaToday(), to: manilaToday() };
    const baselineRes = await request(app)
      .get("/api/reports/sales-summary")
      .query(range)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(baselineRes.status).toBe(200);
    const baseline = baselineRes.body.data;

    // Two completed orders with distinct payment methods.
    const cashRes = await createOrder("cash", 150);
    expect(cashRes.status).toBe(201);
    expect((await completeOrder(cashRes.body.data.id)).status).toBe(200);

    const gcashRes = await createOrder("gcash", 250);
    expect(gcashRes.status).toBe(201);
    expect((await completeOrder(gcashRes.body.data.id)).status).toBe(200);

    // An incomplete order that must NOT be counted.
    await createOrder("cash", 999);

    const afterRes = await request(app)
      .get("/api/reports/sales-summary")
      .query(range)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(afterRes.status).toBe(200);
    const after = afterRes.body.data;

    expect(after.order_count - baseline.order_count).toBe(2);
    expect(after.total_revenue - baseline.total_revenue).toBeCloseTo(400, 6);
    expect(
      after.revenue_by_payment_method.cash -
        baseline.revenue_by_payment_method.cash,
    ).toBeCloseTo(150, 6);
    expect(
      after.revenue_by_payment_method.gcash -
        baseline.revenue_by_payment_method.gcash,
    ).toBeCloseTo(250, 6);

    // Cross-check the average against the two numbers we just measured.
    expect(after.average_order_value).toBeCloseTo(
      after.total_revenue / after.order_count,
      6,
    );
  });

  it("returns all three payment method keys even with zero revenue", async () => {
    // Far-future window that will never contain real orders — proves the
    // empty-range shape (zeros, not nulls/missing keys).
    const res = await request(app)
      .get("/api/reports/sales-summary")
      .query({ from: "2099-01-01", to: "2099-12-31" })
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      from_date: "2099-01-01",
      to_date: "2099-12-31",
      total_revenue: 0,
      order_count: 0,
      revenue_by_payment_method: { cash: 0, gcash: 0, maya: 0 },
      average_order_value: 0,
    });
  });
});
