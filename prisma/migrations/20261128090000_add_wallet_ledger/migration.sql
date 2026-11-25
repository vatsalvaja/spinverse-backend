-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('INITIAL_CREDIT', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'GAME_ENTRY_DEBIT', 'GAME_WINNING_CREDIT', 'GAME_REFUND', 'BONUS_CREDIT');

-- CreateEnum
CREATE TYPE "WalletTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "demo_wallets" ADD COLUMN     "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "totalCredited" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalDebited" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "direction" "WalletTransactionDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceBefore" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "gameId" TEXT,
    "sessionId" TEXT,
    "roundId" TEXT,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key" ON "wallet_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_createdAt_idx" ON "wallet_transactions"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_userId_createdAt_idx" ON "wallet_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_createdAt_idx" ON "wallet_transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_roundId_idx" ON "wallet_transactions"("roundId");

-- CreateIndex
CREATE INDEX "wallet_transactions_gameId_createdAt_idx" ON "wallet_transactions"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "demo_wallets_status_idx" ON "demo_wallets"("status");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "demo_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written part (Prisma cannot express these)
-- ---------------------------------------------------------------------------

-- 1. Wallets created in Phase 6 have a balance but no history. Give each an opening ledger entry so that
--    balance = totalCredited - totalDebited holds from the start.
INSERT INTO "wallet_transactions"
  ("id", "walletId", "userId", "type", "direction", "amount", "balanceBefore", "balanceAfter", "description", "idempotencyKey", "createdAt")
SELECT gen_random_uuid()::text, w."id", w."userId", 'INITIAL_CREDIT', 'CREDIT', w."balance", 0, w."balance",
       'Opening balance carried over from the first wallet version', 'initial:' || w."userId", CURRENT_TIMESTAMP
FROM "demo_wallets" w
WHERE w."balance" > 0;

UPDATE "demo_wallets" SET "totalCredited" = "balance";

-- 2. Last line of defence: the database itself refuses a negative balance, a negative total, or a
--    ledger entry with a non-positive amount or a negative resulting balance.
ALTER TABLE "demo_wallets"
  ADD CONSTRAINT "demo_wallets_balance_non_negative" CHECK ("balance" >= 0),
  ADD CONSTRAINT "demo_wallets_totals_non_negative" CHECK ("totalCredited" >= 0 AND "totalDebited" >= 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "wallet_transactions_balances_non_negative" CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0);

-- 3. The ledger is append-only: rows can be inserted but never changed or removed, by anyone.
CREATE FUNCTION "wallet_transactions_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_transactions_no_update"
  BEFORE UPDATE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION "wallet_transactions_append_only"();

CREATE TRIGGER "wallet_transactions_no_delete"
  BEFORE DELETE ON "wallet_transactions"
  FOR EACH ROW EXECUTE FUNCTION "wallet_transactions_append_only"();

