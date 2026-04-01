-- CreateTable
CREATE TABLE "attendance_photos" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendance_photos" ADD CONSTRAINT "attendance_photos_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
