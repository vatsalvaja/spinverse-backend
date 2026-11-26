-- Step 2 of 2 for the Super Admin -> Master -> Client hierarchy (step 1 added the enum values).
--
-- Existing data is untouched: the two new users columns are nullable, so every current user (USER or ADMIN)
-- simply has no parent and is not deleted. No user, wallet, round or ledger row is rewritten.

-- CreateEnum
CREATE TYPE "CoinTransferType" AS ENUM ('MASTER_ALLOCATION', 'CLIENT_ALLOCATION', 'CLIENT_RECLAIM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "coin_transfers" (
    "id" TEXT NOT NULL,
    "type" "CoinTransferType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "senderBalanceAfter" DECIMAL(14,2),
    "receiverBalanceAfter" DECIMAL(14,2) NOT NULL,
    "senderTransactionId" TEXT,
    "receiverTransactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coin_transfers_senderTransactionId_key" ON "coin_transfers"("senderTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "coin_transfers_receiverTransactionId_key" ON "coin_transfers"("receiverTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "coin_transfers_idempotencyKey_key" ON "coin_transfers"("idempotencyKey");

-- CreateIndex
CREATE INDEX "coin_transfers_masterId_createdAt_idx" ON "coin_transfers"("masterId", "createdAt");

-- CreateIndex
CREATE INDEX "coin_transfers_senderId_createdAt_idx" ON "coin_transfers"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "coin_transfers_receiverId_createdAt_idx" ON "coin_transfers"("receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "coin_transfers_type_createdAt_idx" ON "coin_transfers"("type", "createdAt");

-- CreateIndex
CREATE INDEX "coin_transfers_createdAt_idx" ON "coin_transfers"("createdAt");

-- CreateIndex
CREATE INDEX "users_parentId_idx" ON "users"("parentId");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transfers" ADD CONSTRAINT "coin_transfers_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transfers" ADD CONSTRAINT "coin_transfers_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transfers" ADD CONSTRAINT "coin_transfers_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transfers" ADD CONSTRAINT "coin_transfers_senderTransactionId_fkey" FOREIGN KEY ("senderTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transfers" ADD CONSTRAINT "coin_transfers_receiverTransactionId_fkey" FOREIGN KEY ("receiverTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written part (Prisma cannot express these)
-- ---------------------------------------------------------------------------

-- 1. The hierarchy rule, enforced by the database itself (not only by the API):
--    a CLIENT always has a parent, nobody else has one, and nobody is their own parent.
ALTER TABLE "users"
  ADD CONSTRAINT "users_client_parent_rule" CHECK (
    ("role" = 'CLIENT' AND "parentId" IS NOT NULL) OR ("role" <> 'CLIENT' AND "parentId" IS NULL)
  ),
  ADD CONSTRAINT "users_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- 2. The parent must be a MASTER, and a MASTER that still has clients cannot be turned into another role.
CREATE FUNCTION "users_parent_must_be_master"() RETURNS trigger AS $$
BEGIN
  IF NEW."parentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "users" WHERE "id" = NEW."parentId" AND "role" = 'MASTER'
  ) THEN
    RAISE EXCEPTION 'users.parentId must reference a MASTER account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_parent_must_be_master"
  BEFORE INSERT OR UPDATE OF "parentId", "role" ON "users"
  FOR EACH ROW EXECUTE FUNCTION "users_parent_must_be_master"();

CREATE FUNCTION "users_master_keeps_role_while_it_has_clients"() RETURNS trigger AS $$
BEGIN
  IF OLD."role" = 'MASTER' AND NEW."role" <> 'MASTER' AND EXISTS (
    SELECT 1 FROM "users" WHERE "parentId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'A MASTER that still has clients cannot change role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_master_keeps_role_while_it_has_clients"
  BEFORE UPDATE OF "role" ON "users"
  FOR EACH ROW EXECUTE FUNCTION "users_master_keeps_role_while_it_has_clients"();

-- 3. Coin transfers: sane amounts and a consistent shape per type.
ALTER TABLE "coin_transfers"
  ADD CONSTRAINT "coin_transfers_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "coin_transfers_balances_non_negative" CHECK (
    "receiverBalanceAfter" >= 0 AND ("senderBalanceAfter" IS NULL OR "senderBalanceAfter" >= 0)
  ),
  ADD CONSTRAINT "coin_transfers_sender_not_receiver" CHECK ("senderId" <> "receiverId"),
  -- the super admin issues coins (no sender wallet); every other transfer debits a sender wallet
  ADD CONSTRAINT "coin_transfers_sender_leg_rule" CHECK (
    ("type" = 'MASTER_ALLOCATION' AND "senderTransactionId" IS NULL AND "senderBalanceAfter" IS NULL)
    OR ("type" <> 'MASTER_ALLOCATION' AND "senderTransactionId" IS NOT NULL AND "senderBalanceAfter" IS NOT NULL)
  );

-- 4. Who may be on each side of a transfer. A last line of defence behind the API's own checks.
CREATE FUNCTION "coin_transfers_validate_parties"() RETURNS trigger AS $$
DECLARE
  sender_role "Role";
  receiver_role "Role";
  receiver_parent TEXT;
  sender_parent TEXT;
BEGIN
  SELECT "role", "parentId" INTO sender_role, sender_parent FROM "users" WHERE "id" = NEW."senderId";
  SELECT "role", "parentId" INTO receiver_role, receiver_parent FROM "users" WHERE "id" = NEW."receiverId";

  IF NEW."type" = 'MASTER_ALLOCATION' THEN
    IF sender_role <> 'SUPER_ADMIN' OR receiver_role <> 'MASTER' OR NEW."masterId" <> NEW."receiverId" THEN
      RAISE EXCEPTION 'MASTER_ALLOCATION must go from a SUPER_ADMIN to a MASTER';
    END IF;
  ELSIF NEW."type" = 'CLIENT_ALLOCATION' THEN
    IF sender_role <> 'MASTER' OR receiver_role <> 'CLIENT' OR receiver_parent IS DISTINCT FROM NEW."senderId" OR NEW."masterId" <> NEW."senderId" THEN
      RAISE EXCEPTION 'CLIENT_ALLOCATION must go from a MASTER to one of its own CLIENTs';
    END IF;
  ELSIF NEW."type" = 'CLIENT_RECLAIM' THEN
    IF sender_role <> 'CLIENT' OR receiver_role <> 'MASTER' OR sender_parent IS DISTINCT FROM NEW."receiverId" OR NEW."masterId" <> NEW."receiverId" THEN
      RAISE EXCEPTION 'CLIENT_RECLAIM must go from a CLIENT back to its own MASTER';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "coin_transfers_validate_parties"
  BEFORE INSERT ON "coin_transfers"
  FOR EACH ROW EXECUTE FUNCTION "coin_transfers_validate_parties"();

-- 5. The transfer history is append-only: rows can be inserted but never changed or removed.
CREATE FUNCTION "coin_transfers_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'coin_transfers is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "coin_transfers_no_update"
  BEFORE UPDATE ON "coin_transfers"
  FOR EACH ROW EXECUTE FUNCTION "coin_transfers_append_only"();

CREATE TRIGGER "coin_transfers_no_delete"
  BEFORE DELETE ON "coin_transfers"
  FOR EACH ROW EXECUTE FUNCTION "coin_transfers_append_only"();
