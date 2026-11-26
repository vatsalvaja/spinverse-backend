-- Step 1 of 2 for the Super Admin -> Master -> Client hierarchy: new enum values only.
--
-- PostgreSQL refuses to USE a freshly added enum value in the same transaction that added it, so everything
-- that references these values (constraints, triggers, tables) lives in the next migration,
-- 20261130090100_add_user_hierarchy_and_coin_transfers. Nothing here touches existing rows: every current user
-- keeps the role USER or ADMIN and every existing ledger entry keeps its type.
--
-- Requires PostgreSQL 12 or newer (ALTER TYPE ... ADD VALUE inside a transaction).

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MASTER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';

-- AlterEnum
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COIN_ALLOCATION_CREDIT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COIN_ALLOCATION_DEBIT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COIN_RECLAIM_CREDIT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'COIN_RECLAIM_DEBIT';
