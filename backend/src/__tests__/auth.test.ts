import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, createCustomer, resetDb, uuid } from "./helpers.js";

beforeEach(resetDb);

describe("auth", () => {
  it("rejects signup with a non-4-digit PIN", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ fullName: "Bad Pin", phone: "+252699999999", password: "password123", pin: "12" });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate phone numbers", async () => {
    const a = await createCustomer({ phone: "+252611119999" });
    const res = await request(app)
      .post("/auth/signup")
      .send({ fullName: "Dup", phone: a.phone, password: "password123", pin: "1234" });
    expect(res.status).toBe(409);
  });

  it("rejects login with the wrong password without revealing whether the phone exists", async () => {
    const a = await createCustomer();
    const wrongPassword = await request(app).post("/auth/login").send({ phone: a.phone, password: "nope12345" });
    const unknownPhone = await request(app).post("/auth/login").send({ phone: "+252600000000", password: "nope12345" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownPhone.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownPhone.body.error.message);
  });

  it("verify-pin confirms a correct PIN and rejects a wrong one", async () => {
    const a = await createCustomer();
    const ok = await request(app).post("/auth/verify-pin").set("authorization", `Bearer ${a.token}`).send({ pin: a.pin });
    expect(ok.status).toBe(200);
    const bad = await request(app).post("/auth/verify-pin").set("authorization", `Bearer ${a.token}`).send({ pin: "0000" });
    expect(bad.status).toBe(401);
  });

  it("locks the PIN out after repeated wrong attempts", async () => {
    const a = await createCustomer();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await request(app)
        .post("/wallet/deposit")
        .set("authorization", `Bearer ${a.token}`)
        .send({ amountUsd: 1, pin: "0000", idempotencyKey: uuid() });
    }
    expect(last!.status).toBe(401);
    expect(last!.body.error.message).toMatch(/locked/i);

    // Even the *correct* PIN is rejected while locked out.
    const stillLocked = await request(app)
      .post("/wallet/deposit")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 1, pin: a.pin, idempotencyKey: uuid() });
    expect(stillLocked.status).toBe(401);
  });
});
