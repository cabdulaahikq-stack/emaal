import { prisma } from "../lib/db.js";
import { hmacSign } from "../lib/security.js";

const MAX_ATTEMPTS = 5;

/**
 * Delivers a signed webhook for a partner-linked transaction, if the partner
 * has a webhookUrl configured. Best-effort: failures are recorded but never
 * thrown back at the caller, since a webhook outage must not block money
 * actually moving.
 */
export async function queueWebhook(transactionId: string): Promise<void> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { partner: true },
  });
  if (!transaction?.partnerId || !transaction.partner?.webhookUrl || !transaction.partner.webhookSecret) return;

  const delivery = await prisma.webhookDelivery.create({
    data: {
      transactionId: transaction.id,
      partnerId: transaction.partnerId,
      url: transaction.partner.webhookUrl,
      status: "PENDING",
    },
  });

  await attemptDelivery(delivery.id);
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { transaction: true },
  });
  const partner = await prisma.apiPartner.findUniqueOrThrow({ where: { id: delivery.partnerId } });
  if (!partner.webhookSecret) return;

  const payload = JSON.stringify({
    event: "transaction.updated",
    transactionId: delivery.transaction.id,
    type: delivery.transaction.type,
    status: delivery.transaction.status,
    amountMinor: delivery.transaction.amountMinor.toString(),
    currency: delivery.transaction.currency,
  });
  const signature = hmacSign(payload, partner.webhookSecret);

  try {
    const res = await fetch(delivery.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-emaal-signature": signature },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Webhook endpoint responded ${res.status}`);
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "DELIVERED", attempts: { increment: 1 } },
    });
  } catch (err) {
    const attempts = delivery.attempts + 1;
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        attempts,
        lastError: err instanceof Error ? err.message : "Unknown error",
      },
    });
  }
}
