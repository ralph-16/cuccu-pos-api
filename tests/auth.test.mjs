// tests/auth.test.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
dotenv.config();

import app from "../src/app.js";

describe("Auth", () => {
  it("rejects login with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nonexistent@cuccu.test", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("rejects login with malformed email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "something" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed.");
  });

  it("logs in successfully with valid owner credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_OWNER_EMAIL,
      password: process.env.TEST_OWNER_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.user.email).toBe(process.env.TEST_OWNER_EMAIL);
  });

  it("rejects requests to protected routes with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a garbage token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(401);
  });

  it("returns the correct profile and role for a valid token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: process.env.TEST_OWNER_EMAIL,
      password: process.env.TEST_OWNER_PASSWORD,
    });

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.access_token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.profile.role).toBe("owner");
  });
});
