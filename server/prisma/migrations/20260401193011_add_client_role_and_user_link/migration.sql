-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'client';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_clientId_key" ON "users"("clientId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
