// tests/products.test.js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
dotenv.config();

import app from "../src/app.js";

describe("Products CRUD", () => {
  let ownerToken;
  let cashierToken;
  let createdProductId;

  beforeAll(async () => {
    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_OWNER_EMAIL,
      password: process.env.TEST_OWNER_PASSWORD,
    });
    ownerToken = ownerLogin.body.access_token;
    console.log("DEBUG owner login:", ownerLogin.status, JSON.stringify(ownerLogin.body).slice(0, 200));

    const cashierLogin = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_CASHIER_EMAIL,
      password: process.env.TEST_CASHIER_PASSWORD,
    });
    cashierToken = cashierLogin.body.access_token;
    console.log("DEBUG cashier login:", cashierLogin.status, JSON.stringify(cashierLogin.body).slice(0, 200));
  });

  afterAll(async () => {
    // Clean up the product this test suite created, so re-running tests
    // doesn't leave junk data behind in a real Supabase project.
    if (createdProductId) {
      await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
    }
  });

  it("allows any authenticated user to list products", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${cashierToken}`);

    console.log("DEBUG products list:", res.status, JSON.stringify(res.body));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("rejects product creation with invalid body (missing name)", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ category_id: 1 });

    expect(res.status).toBe(400);
  });

  it("blocks cashiers from creating products (fast-fail + RLS)", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ category_id: 1, name: "Cashier Should Not Create This" });

    expect(res.status).toBe(403);
  });

  it("allows owners to create a product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ category_id: 1, name: "Vitest Test Product" });

    console.log("DEBUG create product:", res.status, JSON.stringify(res.body));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Vitest Test Product");
    createdProductId = res.body.data.id;
  });

  it("allows owners to update a product", async () => {
    const res = await request(app)
      .patch(`/api/products/${createdProductId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ is_available: false });

    expect(res.status).toBe(200);
    expect(res.body.data.is_available).toBe(false);
  });

  it("blocks cashiers from deleting products", async () => {
    const res = await request(app)
      .delete(`/api/products/${createdProductId}`)
      .set("Authorization", `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
  });
});