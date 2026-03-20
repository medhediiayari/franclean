-- AlterTable
ALTER TABLE "event_shifts" ADD COLUMN     "agentId" TEXT;

-- AddForeignKey
ALTER TABLE "event_shifts" ADD CONSTRAINT "event_shifts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
