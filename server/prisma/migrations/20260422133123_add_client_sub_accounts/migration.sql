-- DropIndex
DROP INDEX "users_clientId_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isMainAccount" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "client_user_sites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientSiteId" TEXT NOT NULL,

    CONSTRAINT "client_user_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_user_sites_userId_clientSiteId_key" ON "client_user_sites"("userId", "clientSiteId");

-- AddForeignKey
ALTER TABLE "client_user_sites" ADD CONSTRAINT "client_user_sites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_user_sites" ADD CONSTRAINT "client_user_sites_clientSiteId_fkey" FOREIGN KEY ("clientSiteId") REFERENCES "client_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
