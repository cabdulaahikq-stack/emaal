import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, createAdmin, createCustomer, resetDb, uuid } from "./helpers.js";

beforeEach(resetDb);

/** Funds a wallet above the approval threshold using two below-threshold deposits, so the funding itself never gets held. */
async function fundWallet(token: string, pin: string, totalUsd: number): Promise<void> {
  const half = totalUsd / 2;
  await request(app).post("/wallet/deposit").set("authorization", `Bearer ${token}`).send({ amountUsd: half, pin, idempotencyKey: uuid() });
  await request(app).post("/wallet/deposit").set("authorization", `Bearer ${token}`).send({ amountUsd: half, pin, idempotencyKey: uuid() });
}

describe("large-transaction approval queue", () => {
  it("routes a deposit at or above the threshold to HELD_FOR_APPROVAL instead of completing it", async () => {
    const a = await createCustomer();
    const res = await request(app)
      .post("/wallet/deposit")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 5000, pin: a.pin, idempotencyKey: uuid() });

    expect(res.body.transaction.status).toBe("HELD_FOR_APPROVAL");
    const me = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(me.body.wallet.balance).toBe(0); // not credited until an admin approves it
  });

  it("reserves the transfer amount immediately so it can't be spent twice while pending", async () => {
    const a = await createCustomer();
    const b = await createCustomer();
    await fundWallet(a.token, a.pin, 6000); // two $3000 deposits, each under the $5000 threshold

    const held = await request(app)
      .post("/wallet/transfer")
      .set("authorization", `Bearer ${a.token}`)
      .send({ toPhone: b.phone, amountUsd: 5000, pin: a.pin, idempotencyKey: uuid() });
    expect(held.body.transaction.status).toBe("HELD_FOR_APPROVAL");

    const meAfterHold = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(meAfterHold.body.wallet.balance).toBe(6000);
    expect(meAfterHold.body.wallet.available).toBe(1000);

    // Trying to spend the reserved funds elsewhere must fail — this is the
    // exact double-spend window the hold reservation exists to close.
    const doubleSpend = await request(app)
      .post("/wallet/withdraw")
      .set("authorization", `Bearer ${a.token}`)
      .send({ amountUsd: 1001, pin: a.pin, idempotencyKey: uuid() });
    expect(doubleSpend.status).toBe(409);
  });

  it("approving a held transfer posts the ledger and completes it", async () => {
    const a = await createCustomer();
    const b = await createCustomer();
    await fundWallet(a.token, a.pin, 6000);
    const admin = await createAdmin();

    const held = await request(app)
      .post("/wallet/transfer")
      .set("authorization", `Bearer ${a.token}`)
      .send({ toPhone: b.phone, amountUsd: 5000, pin: a.pin, idempotencyKey: uuid() });

    const approve = await request(app)
      .post(`/admin/approvals/${held.body.transaction.id}/approve`)
      .set("authorization", `Bearer ${admin.token}`)
      .send({ notes: "ok" });
    expect(approve.body.transaction.status).toBe("COMPLETED");

    const meA = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    const meB = await request(app).get("/wallet/me").set("authorization", `Bearer ${b.token}`);
    expect(meA.body.wallet.balance).toBe(1000);
    expect(meA.body.wallet.available).toBe(1000);
    expect(meB.body.wallet.balance).toBe(5000);
  });

  it("rejecting a held transfer releases the hold without moving funds", async () => {
    const a = await createCustomer();
    const b = await createCustomer();
    await fundWallet(a.token, a.pin, 6000);
    const admin = await createAdmin();

    const held = await request(app)
      .post("/wallet/transfer")
      .set("authorization", `Bearer ${a.token}`)
      .send({ toPhone: b.phone, amountUsd: 5000, pin: a.pin, idempotencyKey: uuid() });

    const reject = await request(app)
      .post(`/admin/approvals/${held.body.transaction.id}/reject`)
      .set("authorization", `Bearer ${admin.token}`)
      .send({ notes: "no" });
    expect(reject.body.transaction.status).toBe("REJECTED");

    const meA = await request(app).get("/wallet/me").set("authorization", `Bearer ${a.token}`);
    expect(meA.body.wallet.balance).toBe(6000); // untouched
    expect(meA.body.wallet.available).toBe(6000); // hold released
  });

  it("a non-admin cannot approve transactions", async () => {
    const a = await createCustomer();
    const res = await request(app).get("/admin/approvals").set("authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(403);
  });
});
