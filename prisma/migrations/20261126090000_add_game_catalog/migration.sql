-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "GameVisibility" AS ENUM ('PUBLIC', 'HIDDEN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GameOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT', 'BOTH');

-- CreateEnum
CREATE TYPE "GamePlatform" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('NOT_INSTALLED', 'INSTALLING', 'INSTALLED', 'FAILED');

-- CreateTable
CREATE TABLE "game_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "developer" TEXT,
    "categoryId" TEXT NOT NULL,
    "thumbnail" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" "GameStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "GameVisibility" NOT NULL DEFAULT 'PUBLIC',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "orientation" "GameOrientation" NOT NULL DEFAULT 'LANDSCAPE',
    "platforms" "GamePlatform"[] DEFAULT ARRAY['DESKTOP', 'TABLET', 'MOBILE']::"GamePlatform"[],
    "minClientVersion" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "entryPoint" TEXT,
    "packageStatus" "PackageStatus" NOT NULL DEFAULT 'NOT_INSTALLED',
    "installedVersion" TEXT,
    "installedAt" TIMESTAMP(3),
    "publishedVersion" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_categories_name_key" ON "game_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "game_categories_slug_key" ON "game_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "games_gameId_key" ON "games"("gameId");

-- CreateIndex
CREATE INDEX "games_categoryId_idx" ON "games"("categoryId");

-- CreateIndex
CREATE INDEX "games_status_visibility_idx" ON "games"("status", "visibility");

-- CreateIndex
CREATE INDEX "games_displayOrder_idx" ON "games"("displayOrder");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "game_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

