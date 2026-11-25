-- CreateEnum
CREATE TYPE "GameVersionState" AS ENUM ('UPLOADED', 'INSTALLED');

-- CreateEnum
CREATE TYPE "PackageEventType" AS ENUM ('UPLOADED', 'INSTALLED', 'PUBLISHED', 'UNPUBLISHED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GameRoundStatus" AS ENUM ('IN_PROGRESS', 'SETTLED');

-- CreateTable
CREATE TABLE "game_versions" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "unpackedBytes" INTEGER NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "entryPoint" TEXT NOT NULL,
    "validation" JSONB NOT NULL,
    "state" "GameVersionState" NOT NULL DEFAULT 'UPLOADED',
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installedAt" TIMESTAMP(3),

    CONSTRAINT "game_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_package_events" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "versionId" TEXT,
    "version" TEXT NOT NULL,
    "type" "PackageEventType" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_package_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "roundCount" INTEGER NOT NULL DEFAULT 0,
    "totalStaked" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_rounds" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "GameRoundStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "stake" DECIMAL(14,2) NOT NULL,
    "payout" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bet" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "roundState" JSONB NOT NULL,
    "sessionStateBefore" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "seedCommitment" TEXT NOT NULL,
    "rngDraws" INTEGER NOT NULL DEFAULT 0,
    "balanceBefore" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_versions_gameId_uploadedAt_idx" ON "game_versions"("gameId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_versions_gameId_version_key" ON "game_versions"("gameId", "version");

-- CreateIndex
CREATE INDEX "game_package_events_gameId_createdAt_idx" ON "game_package_events"("gameId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "demo_wallets_userId_key" ON "demo_wallets"("userId");

-- CreateIndex
CREATE INDEX "game_sessions_userId_gameId_status_idx" ON "game_sessions"("userId", "gameId", "status");

-- CreateIndex
CREATE INDEX "game_rounds_userId_startedAt_idx" ON "game_rounds"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "game_rounds_gameId_startedAt_idx" ON "game_rounds"("gameId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "game_rounds_sessionId_roundNumber_key" ON "game_rounds"("sessionId", "roundNumber");

-- AddForeignKey
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_package_events" ADD CONSTRAINT "game_package_events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_wallets" ADD CONSTRAINT "demo_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

