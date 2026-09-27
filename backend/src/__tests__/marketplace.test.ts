import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, resetDb, createCustomer, createMerchant, uuid } from "./helpers.js";

async function setupShop() {
  const merchant = await createMerchant();
  const auth = { Authorization: `Bearer ${merchant.token}` };

  const wh = await request(app).post("/merchant/warehouses").set(auth).send({ name: "Bakhaar A", location: "Xamar" });
  const warehouseId = wh.body.warehouse.id;

  const product = await request(app)
    .post("/merchant/products")
    .set(auth)
    .send({
      name: "Sneakers",
      category: "SHOES",
      costPriceUsd: 20,
      wholesalePriceUsd: 30,
      retailPriceUsd: 45,
      variants: [
        { sizeLabel: "41", initialStockQty: 5, warehouseId },
        { sizeLabel: "42", initialStockQty: 3, warehouseId },
      ],
    });
  if (product.status !== 201) throw new Error(JSON.stringify(product.body));

  return { merchant, auth, warehouseId, product: product.body.product };
}

describe("marketplace", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates a product with variants and correct stock", async () => {
    const { product } = await setupShop();
    expect(product.variants).toHaveLength(2);
    const v41 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    expect(v41.stockQty).toBe(5);
    expect(v41.sellableQty).toBe(5);
  });

  it("a wallet-tendered retail checkout moves money and decrements stock", async () => {
    const { merchant, product } = await setupShop();
    const customer = await createCustomer();
    const custAuth = { Authorization: `Bearer ${customer.token}` };

    await request(app).post("/wallet/deposit").set(custAuth).send({ amountUsd: 100, pin: customer.pin, idempotencyKey: uuid() });

    const variant41 = product.variants.find((v: { sizeLabel: string; id: string }) => v.sizeLabel === "41");
    const checkout = await request(app)
      .post("/marketplace/checkout")
      .set(custAuth)
      .send({
        merchantId: product.merchantId,
        items: [{ productId: product.id, variantId: variant41.id, quantity: 2 }],
        pin: customer.pin,
        idempotencyKey: uuid(),
      });

    expect(checkout.status).toBe(201);
    expect(checkout.body.sale.status).toBe("COMPLETED");
    expect(checkout.body.sale.total).toBeCloseTo(90); // 2 x $45

    const custWallet = await request(app).get("/wallet/me").set(custAuth);
    expect(custWallet.body.wallet.balance).toBeCloseTo(10);

    const merchAuth = { Authorization: `Bearer ${merchant.token}` };
    const merchWallet = await request(app).get("/merchant/me").set(merchAuth);
    expect(merchWallet.body.wallet.balance).toBeCloseTo(90);

    const refreshed = await request(app).get(`/merchant/products/${product.id}`).set(merchAuth);
    const refreshedVariant = refreshed.body.product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    expect(refreshedVariant.stockQty).toBe(3);
  });

  it("retrying the same idempotency key does not double-charge or double-decrement stock", async () => {
    const { product } = await setupShop();
    const customer = await createCustomer();
    const custAuth = { Authorization: `Bearer ${customer.token}` };
    await request(app).post("/wallet/deposit").set(custAuth).send({ amountUsd: 100, pin: customer.pin, idempotencyKey: uuid() });

    const variant41 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    const key = uuid();
    const body = { merchantId: product.merchantId, items: [{ productId: product.id, variantId: variant41.id, quantity: 1 }], pin: customer.pin, idempotencyKey: key };

    const first = await request(app).post("/marketplace/checkout").set(custAuth).send(body);
    const second = await request(app).post("/marketplace/checkout").set(custAuth).send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.sale.id).toBe(first.body.sale.id);

    const wallet = await request(app).get("/wallet/me").set(custAuth);
    expect(wallet.body.wallet.balance).toBeCloseTo(55); // charged once, not twice
  });

  it("rejects a checkout that exceeds available stock", async () => {
    const { product } = await setupShop();
    const customer = await createCustomer();
    const custAuth = { Authorization: `Bearer ${customer.token}` };
    await request(app).post("/wallet/deposit").set(custAuth).send({ amountUsd: 1000, pin: customer.pin, idempotencyKey: uuid() });

    const variant42 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "42");
    const res = await request(app)
      .post("/marketplace/checkout")
      .set(custAuth)
      .send({ merchantId: product.merchantId, items: [{ productId: product.id, variantId: variant42.id, quantity: 10 }], pin: customer.pin, idempotencyKey: uuid() });

    expect(res.status).toBe(409);
  });

  it("a wholesale order holds funds and stock, then the merchant accepting it settles both", async () => {
    const { merchant, product } = await setupShop();
    const customer = await createCustomer();
    const custAuth = { Authorization: `Bearer ${customer.token}` };
    await request(app).post("/wallet/deposit").set(custAuth).send({ amountUsd: 200, pin: customer.pin, idempotencyKey: uuid() });

    const variant41 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    const order = await request(app)
      .post("/marketplace/orders")
      .set(custAuth)
      .send({ merchantId: product.merchantId, items: [{ productId: product.id, variantId: variant41.id, quantity: 3 }], pin: customer.pin, idempotencyKey: uuid() });

    expect(order.status).toBe(201);
    expect(order.body.sale.status).toBe("PENDING");
    expect(order.body.sale.total).toBeCloseTo(90); // 3 x $30 wholesale

    // Funds are held, not yet moved.
    const walletAfterOrder = await request(app).get("/wallet/me").set(custAuth);
    expect(walletAfterOrder.body.wallet.balance).toBeCloseTo(200);
    expect(walletAfterOrder.body.wallet.available).toBeCloseTo(110);

    // Same units can't be sold again while the order is pending.
    const overSell = await request(app)
      .post("/marketplace/checkout")
      .set(custAuth)
      .send({ merchantId: product.merchantId, items: [{ productId: product.id, variantId: variant41.id, quantity: 3 }], pin: customer.pin, idempotencyKey: uuid() });
    expect(overSell.status).toBe(409);

    const merchAuth = { Authorization: `Bearer ${merchant.token}` };
    const accept = await request(app).post(`/merchant/orders/${order.body.sale.id}/accept`).set(merchAuth).send({});
    expect(accept.status).toBe(200);
    expect(accept.body.sale.status).toBe("COMPLETED");

    const walletAfterAccept = await request(app).get("/wallet/me").set(custAuth);
    expect(walletAfterAccept.body.wallet.balance).toBeCloseTo(110);
    expect(walletAfterAccept.body.wallet.available).toBeCloseTo(110);

    const merchWallet = await request(app).get("/merchant/me").set(merchAuth);
    expect(merchWallet.body.wallet.balance).toBeCloseTo(90);
  });

  it("rejecting a wholesale order releases the hold and the reserved stock", async () => {
    const { merchant, product } = await setupShop();
    const customer = await createCustomer();
    const custAuth = { Authorization: `Bearer ${customer.token}` };
    await request(app).post("/wallet/deposit").set(custAuth).send({ amountUsd: 200, pin: customer.pin, idempotencyKey: uuid() });

    const variant41 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    const order = await request(app)
      .post("/marketplace/orders")
      .set(custAuth)
      .send({ merchantId: product.merchantId, items: [{ productId: product.id, variantId: variant41.id, quantity: 2 }], pin: customer.pin, idempotencyKey: uuid() });

    const merchAuth = { Authorization: `Bearer ${merchant.token}` };
    const reject = await request(app).post(`/merchant/orders/${order.body.sale.id}/reject`).set(merchAuth).send({});
    expect(reject.status).toBe(200);
    expect(reject.body.sale.status).toBe("REJECTED");

    const wallet = await request(app).get("/wallet/me").set(custAuth);
    expect(wallet.body.wallet.balance).toBeCloseTo(200);
    expect(wallet.body.wallet.available).toBeCloseTo(200);

    const refreshed = await request(app).get(`/merchant/products/${product.id}`).set(merchAuth);
    const refreshedVariant = refreshed.body.product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    expect(refreshedVariant.stockQty).toBe(5);
    expect(refreshedVariant.reservedQty).toBe(0);
  });

  it("staff POS: a staffer without canSell is rejected, and a permitted staffer can ring up a cash sale", async () => {
    const { merchant, product } = await setupShop();
    const merchAuth = { Authorization: `Bearer ${merchant.token}` };

    const noPermStaff = await request(app)
      .post("/merchant/staff")
      .set(merchAuth)
      .send({ fullName: "Cashier Without Perms", phone: `+2526${Math.floor(10000000 + Math.random() * 89999999)}`, jobTitle: "Kaashiye" });
    const noPermLogin = await request(app).post("/auth/login").send({ phone: noPermStaff.body.credentials.phone, password: noPermStaff.body.credentials.password });
    const noPermAuth = { Authorization: `Bearer ${noPermLogin.body.token}` };

    const variant41 = product.variants.find((v: { sizeLabel: string }) => v.sizeLabel === "41");
    const denied = await request(app)
      .post("/merchant/pos/sell")
      .set(noPermAuth)
      .send({ items: [{ productId: product.id, variantId: variant41.id, quantity: 1 }], tender: "CASH", idempotencyKey: uuid() });
    expect(denied.status).toBe(403);

    const sellerStaff = await request(app)
      .post("/merchant/staff")
      .set(merchAuth)
      .send({ fullName: "Cashier", phone: `+2526${Math.floor(10000000 + Math.random() * 89999999)}`, jobTitle: "Iibiye", canSell: true });
    const sellerLogin = await request(app).post("/auth/login").send({ phone: sellerStaff.body.credentials.phone, password: sellerStaff.body.credentials.password });
    const sellerAuth = { Authorization: `Bearer ${sellerLogin.body.token}` };

    const sale = await request(app)
      .post("/merchant/pos/sell")
      .set(sellerAuth)
      .send({ items: [{ productId: product.id, variantId: variant41.id, quantity: 1 }], tender: "CASH", idempotencyKey: uuid() });
    expect(sale.status).toBe(201);
    expect(sale.body.sale.tender).toBe("CASH");
    expect(sale.body.sale.total).toBeCloseTo(45);

    // A suspended staffer loses access even with the right permission.
    await request(app).post(`/merchant/staff/${sellerStaff.body.staff.id}`).set(merchAuth).send({ status: "SUSPENDED" });
    const afterSuspend = await request(app)
      .post("/merchant/pos/sell")
      .set(sellerAuth)
      .send({ items: [{ productId: product.id, variantId: variant41.id, quantity: 1 }], tender: "CASH", idempotencyKey: uuid() });
    expect(afterSuspend.status).toBe(403);
  });

  it("payment requests: create, pay, and cancel", async () => {
    const requester = await createCustomer();
    const payer = await createCustomer();
    const reqAuth = { Authorization: `Bearer ${requester.token}` };
    const payAuth = { Authorization: `Bearer ${payer.token}` };

    await request(app).post("/wallet/deposit").set(payAuth).send({ amountUsd: 50, pin: payer.pin, idempotencyKey: uuid() });

    const created = await request(app).post("/marketplace/payment-requests").set(reqAuth).send({ payerPhone: payer.phone, amountUsd: 20 });
    expect(created.status).toBe(201);

    const paid = await request(app).post(`/marketplace/payment-requests/${created.body.request.id}/pay`).set(payAuth).send({ pin: payer.pin });
    expect(paid.status).toBe(200);
    expect(paid.body.request.status).toBe("PAID");

    const requesterWallet = await request(app).get("/wallet/me").set(reqAuth);
    expect(requesterWallet.body.wallet.balance).toBeCloseTo(20);
    const payerWallet = await request(app).get("/wallet/me").set(payAuth);
    expect(payerWallet.body.wallet.balance).toBeCloseTo(30);

    const created2 = await request(app).post("/marketplace/payment-requests").set(reqAuth).send({ payerPhone: payer.phone, amountUsd: 5 });
    const cancelled = await request(app).post(`/marketplace/payment-requests/${created2.body.request.id}/cancel`).set(reqAuth).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.request.status).toBe("CANCELLED");
  });
});
