import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/db.js";
import { _resetSystemWalletCache } from "../lib/systemWallet.js";

export const app = createApp();

export async function resetDb(): Promise<void> {
  _resetSystemWalletCache();
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.webhookDelivery.deleteMany(),
    prisma.apiRequestLog.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.approvalRequest.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.apiPartner.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

interface Customer {
  token: string;
  phone: string;
  pin: string;
  userId: string;
}

export async function createCustomer(overrides?: Partial<{ fullName: string; phone: string; password: string; pin: string }>): Promise<Customer> {
  const phone = overrides?.phone ?? `+2526${Math.floor(10000000 + Math.random() * 89999999)}`;
  const pin = overrides?.pin ?? "1234";
  const res = await request(app)
    .post("/auth/signup")
    .send({
      fullName: overrides?.fullName ?? "Test Customer",
      phone,
      password: overrides?.password ?? "password123",
      pin,
    });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, phone, pin, userId: res.body.user.id };
}

export async function createAdmin(): Promise<{ token: string; userId: string }> {
  const { hashSecret } = await import("../lib/security.js");
  const phone = `+2526admin${randomUUID().slice(0, 6)}`;
  const admin = await prisma.user.create({
    data: {
      role: "ADMIN",
      fullName: "Test Admin",
      phone,
      passwordHash: await hashSecret("adminpass123"),
      pinHash: await hashSecret("0000"),
    },
  });
  const res = await request(app).post("/auth/login").send({ phone, password: "adminpass123" });
  if (res.status !== 200) throw new Error(`admin login failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, userId: admin.id };
}

export function uuid(): string {
  return randomUUID();
}
