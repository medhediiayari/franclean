-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "clientPhotosCheckin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "clientPhotosWork" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "client_sites" ADD COLUMN     "contractualHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "canSeeCheckinPhotos" BOOLEAN,
ADD COLUMN     "canSeeWorkPhotos" BOOLEAN;

-- CreateTable
CREATE TABLE "monthly_hours_summaries" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confirmedByAgent" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "agentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_hours_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_hours_summaries_agentId_year_month_key"
ON "monthly_hours_summaries"("agentId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key"
ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "monthly_hours_summaries"
ADD CONSTRAINT "monthly_hours_summaries_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;