-- AlterTable
ALTER TABLE "events" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_draft_versions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL DEFAULT 1,
    "snapshot" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_draft_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event_draft_versions" ADD CONSTRAINT "event_draft_versions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
