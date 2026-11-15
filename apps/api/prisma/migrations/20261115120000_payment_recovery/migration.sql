-- CreateEnum
CREATE TYPE "PaymentDispatchStatus" AS ENUM ('PENDING_DISPATCH', 'DISPATCHING', 'AWAITING_GATEWAY', 'COMPLETED', 'NEEDS_INTERVENTION');

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "scenario" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN "dispatch_status" "PaymentDispatchStatus" NOT NULL DEFAULT 'PENDING_DISPATCH',
ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dispatch_lease_until" TIMESTAMP(3),
ADD COLUMN "next_retry_at" TIMESTAMP(3),
ADD COLUMN "last_error" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill completed payments
UPDATE "payments"
SET "dispatch_status" = 'COMPLETED'
WHERE "status" IN ('SUCCESS', 'FAILED');

-- Ensure non-negative attempt count
ALTER TABLE "payments" ADD CONSTRAINT "payments_attempt_count_nonneg" CHECK ("attempt_count" >= 0);

-- CreateIndex
CREATE INDEX "payments_status_dispatch_status_next_retry_at_idx" ON "payments"("status", "dispatch_status", "next_retry_at");
