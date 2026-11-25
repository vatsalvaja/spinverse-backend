-- AlterEnum
ALTER TYPE "PackageEventType" ADD VALUE 'UNINSTALLED';

-- AlterTable
ALTER TABLE "game_rounds" ADD COLUMN     "packageVersion" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "game_rounds_userId_gameId_startedAt_idx" ON "game_rounds"("userId", "gameId", "startedAt");

-- CreateIndex
CREATE INDEX "game_rounds_status_startedAt_idx" ON "game_rounds"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written part (Prisma cannot express these)
-- ---------------------------------------------------------------------------

-- 1. The audit log is append-only: entries can be inserted but never changed or removed, by anyone.
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

-- 2. A settled round is a historical result: once its status is SETTLED the row can never be changed or
--    removed. (An IN_PROGRESS round may still be updated until it settles; that update is allowed because the
--    row is not yet settled when the trigger looks at it.)
CREATE FUNCTION "game_rounds_settled_is_final"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'SETTLED' THEN
    RAISE EXCEPTION 'game_rounds: a settled round is immutable (% refused)', TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "game_rounds_settled_no_update"
  BEFORE UPDATE ON "game_rounds"
  FOR EACH ROW EXECUTE FUNCTION "game_rounds_settled_is_final"();

CREATE TRIGGER "game_rounds_settled_no_delete"
  BEFORE DELETE ON "game_rounds"
  FOR EACH ROW EXECUTE FUNCTION "game_rounds_settled_is_final"();

