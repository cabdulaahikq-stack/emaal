-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_merchantId_idempotencyKey_key" ON "Sale"("merchantId", "idempotencyKey");
