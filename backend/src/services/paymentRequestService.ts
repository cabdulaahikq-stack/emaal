import { prisma } from "../lib/db.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";
import { transfer, getWalletForUser } from "./walletService.js";

interface CreateRequestInput {
  requesterId: string;
  payerPhone: string;
  amountMinor: bigint;
}

export async function createPaymentRequest(input: CreateRequestInput) {
  if (input.amountMinor <= 0n) throw new ValidationError("Amount must be greater than zero");
  const payer = await prisma.user.findUnique({ where: { phone: input.payerPhone } });
  if (!payer || payer.role !== "CUSTOMER") throw new NotFoundError("No customer found with that phone number");
  if (payer.id === input.requesterId) throw new ValidationError("Cannot request payment from yourself");

  const request = await prisma.paymentRequest.create({
    data: { requesterId: input.requesterId, payerPhone: input.payerPhone, amountMinor: input.amountMinor },
  });
  await recordAudit({ actorId: input.requesterId, action: "payment_request.created", targetType: "PaymentRequest", targetId: request.id, metadata: { amountMinor: input.amountMinor.toString() } });
  return request;
}

export async function getPaymentRequest(requestId: string) {
  const request = await prisma.paymentRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { fullName: true, phone: true } } },
  });
  if (!request) throw new NotFoundError("Payment request not found");
  return request;
}

export async function listOutstandingRequests(requesterId: string) {
  return prisma.paymentRequest.findMany({
    where: { requesterId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function listIncomingRequests(payerPhone: string) {
  return prisma.paymentRequest.findMany({
    where: { payerPhone, status: "PENDING" },
    include: { requester: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** The payer approves with their own PIN (checked by the caller, same as any other money-moving action) and it settles as an ordinary transfer. */
export async function payPaymentRequest(requestId: string, payerUserId: string, payerPhone: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Payment request not found");
  if (request.status !== "PENDING") throw new ConflictError("This request has already been settled or cancelled");
  if (request.payerPhone !== payerPhone) throw new ForbiddenError("This request isn't addressed to your account");

  const [payerWallet, requesterWallet] = await Promise.all([
    getWalletForUser(payerUserId),
    getWalletForUser(request.requesterId),
  ]);

  const transaction = await transfer(payerWallet.id, requesterWallet.id, {
    amountMinor: request.amountMinor,
    idempotencyKey: request.id,
    idempotencyScope: "payment-request",
  });

  const updated = await prisma.paymentRequest.update({
    where: { id: requestId },
    data: { status: "PAID", transactionId: transaction.id, decidedAt: new Date() },
  });
  await recordAudit({ actorId: payerUserId, action: "payment_request.paid", targetType: "PaymentRequest", targetId: requestId });
  return updated;
}

export async function cancelPaymentRequest(requestId: string, requesterId: string) {
  const request = await prisma.paymentRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Payment request not found");
  if (request.requesterId !== requesterId) throw new ForbiddenError("Not your payment request");
  if (request.status !== "PENDING") throw new ConflictError("This request has already been settled or cancelled");

  const updated = await prisma.paymentRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", decidedAt: new Date() } });
  await recordAudit({ actorId: requesterId, action: "payment_request.cancelled", targetType: "PaymentRequest", targetId: requestId });
  return updated;
}
