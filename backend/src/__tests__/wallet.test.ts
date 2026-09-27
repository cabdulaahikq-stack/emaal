import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, createCustomer, resetDb, uuid } from "./helpers.js";
import { prisma } from "../lib/db.js";

beforeEach(resetDb);

describe("wallet deposit/withdraw/transfer", () => {
  it("deposits funds and the wallet balance reflects it", async () => {
    const a = await createCustomer();
    const res = await request(app)
      .post("/wallet/deposit")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 250, pin: a.pin, idempotencyKey: uuid() });

    expect(res.status).toBe(201);
    expect(res.body.transaction.status).toBe("COMPLETED");

    const me = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(me.body.wallet.balance).toBe(250);
    expect(me.body.wallet.available).toBe(250);
  });

  it("rejects a deposit with the wrong PIN and does not move funds", async () => {
    const a = await createCustomer();
    const res = await request(app)
      .post("/wallet/deposit")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 100, pin: "0000", idempotencyKey: uuid() });

    expect(res.status).toBe(401);
    const me = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(me.body.wallet.balance).toBe(0);
  });

  it("replays an idempotency key instead of double-processing", async () => {
    const a = await createCustomer();
    const key = uuid();
    const first = await request(app).post("/wallet/deposit").set("authorization", `Bearer ${a.token}`).send({ amountUsd: 100, pin: a.pin, idempotencyKey: key });
    const second = await request(app).post("/wallet/deposit").set("authorization", `Bearer ${a.token}`).send({ amountUsd: 100, pin: a.pin, idempotencyKey: key });

    expect(first.body.transaction.id).toBe(second.body.transaction.id);

    const me = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(me.body.wallet.balance).toBe(100); // not 200 — the second call was a replay, not a new deposit
  });

  it("rejects a withdrawal larger than the available balance", async () => {
    const a = await createCustomer();
    await request(app).post("/wallet/deposit").set("authorization", `Bearer ${a.token}`).send({ amountUsd: 50, pin: a.pin, idempotencyKey: uuid() });

    const res = await request(app)
      .post("/wallet/withdraw")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 100, pin: a.pin, idempotencyKey: uuid() });

    expect(res.status).toBe(409);
  });

  it("transfers between two wallets and keeps the ledger balanced (debit + credit net to zero)", async () => {
    const a = await createCustomer();
    const b = await createCustomer();
    await request(app).post("/wallet/deposit").set("authorization", `Bearer ${a.token}`).send({ amountUsd: 300, pin: a.pin, idempotencyKey: uuid() });

    const res = await request(app)
      .post("/wallet/transfer")
      .set("authorization", `Bearer ${a.token}`)
      .send({ toPhone: b.phone, amountUsd: 120, pin: a.pin, idempotencyKey: uuid() });

    expect(res.status).toBe(201);

    const meA = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    const meB = await request(app).get("/wallet/me").set("authorization", `Bearer ${b.token}`);
    expect(meA.body.wallet.balance).toBe(180);
    expect(meB.body.wallet.balance).toBe(120);

    const entries = await prisma.ledgerEntry.findMany({ where: { transactionId: res.body.transaction.id } });
    const net = entries.reduce((sum, e) => sum + (e.direction === "CREDIT" ? e.amountMinor : -e.amountMinor), 0n);
    expect(net).toBe(0n);
  });

  it("cannot transfer to yourself", async () => {
    const a = await createCustomer();
    const res = await request(app)
      .post("/wallet/transfer")
      .set("authorization", `Bearer ${a.token}`)
      .send({ toPhone: a.phone, amountUsd: 10, pin: a.pin, idempotencyKey: uuid() });
    expect(res.status).toBe(403);
  });
});
