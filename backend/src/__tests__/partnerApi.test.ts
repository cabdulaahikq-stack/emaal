import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, createAdmin, createCustomer, resetDb, uuid } from "./helpers.js";

beforeEach(resetDb);

async function setupPartner(scopes: string[]) {
  const admin = await createAdmin();
  const partnerRes = await request(app).post("/admin/partners").set("authorization", `Bearer ${admin.token}`).send({ name: "Test Partner" });
  const partnerId = partnerRes.body.partner.id;
  const keyRes = await request(app)
    .post(`/admin/partners/${partnerId}/keys`)
    .set("authorization", `Bearer ${admin.token}`)
    .send({ scopes });
  return { admin, partnerId, apiKey: keyRes.body.apiKey.plaintext, keyId: keyRes.body.apiKey.id };
}

describe("partner API", () => {
  it("rejects requests without a valid API key", async () => {
    const res = await request(app).get("/v1/wallets/+252611111111");
    expect(res.status).toBe(401);
  });

  it("rejects requests missing the required scope", async () => {
    const { apiKey } = await setupPartner(["transaction:read"]);
    const res = await request(app).get("/v1/wallets/+252611111111").set("authorization", `Bearer ${apiKey}`);
    expect(res.status).toBe(403);
  });

  it("stops working immediately once the key is revoked", async () => {
    const { admin, partnerId, apiKey, keyId } = await setupPartner(["balance:read"]);
    const before = await request(app).get("/v1/wallets/+252611111111").set("authorization", `Bearer ${apiKey}`);
    expect(before.status).toBe(200);

    await request(app).post(`/admin/partners/${partnerId}/keys/${keyId}/revoke`).set("authorization", `Bearer ${admin.token}`);

    const after = await request(app).get("/v1/wallets/+252611111111").set("authorization", `Bearer ${apiKey}`);
    expect(after.status).toBe(401);
  });

  it("cannot pay out more than the settlement balance an admin funded", async () => {
    const { apiKey } = await setupPartner(["transfer:write"]);
    const customer = await createCustomer();
    const res = await request(app)
      .post("/v1/payouts")
      .set("authorization", `Bearer ${apiKey}`)
      .send({ toPhone: customer.phone, amountUsd: 10, idempotencyKey: uuid() });
    expect(res.status).toBe(409); // settlement wallet starts at $0
  });

  it("pays out from a funded settlement balance and the customer receives it", async () => {
    const { admin, partnerId, apiKey } = await setupPartner(["transfer:write"]);
    const customer = await createCustomer();
    await request(app).post(`/admin/partners/${partnerId}/settlement/topup`).set("authorization", `Bearer ${admin.token}`).send({ amountUsd: 500 });

    const res = await request(app)
      .post("/v1/payouts")
      .set("authorization", `Bearer ${apiKey}`)
      .send({ toPhone: customer.phone, amountUsd: 75, idempotencyKey: uuid() });
    expect(res.status).toBe(201);

    const me = await request(app).get("/wallet/me").set("authorization", `Bearer ${customer.token}`);
    expect(me.body.wallet.balance).toBe(75);
  });

  it("suspending a partner blocks its keys even though they aren't individually revoked", async () => {
    const { admin, partnerId, apiKey } = await setupPartner(["balance:read"]);
    await request(app).post(`/admin/partners/${partnerId}/status`).set("authorization", `Bearer ${admin.token}`).send({ status: "SUSPENDED" });

    const res = await request(app).get("/v1/wallets/+252611111111").set("authorization", `Bearer ${apiKey}`);
    expect(res.status).toBe(403);
  });
});
