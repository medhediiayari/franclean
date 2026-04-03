-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'email';

-- AlterTable
ALTER TABLE "email_notification_rules" ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sms_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accountSid" TEXT NOT NULL DEFAULT '',
    "authToken" TEXT NOT NULL DEFAULT '',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_config_pkey" PRIMARY KEY ("id")
);
