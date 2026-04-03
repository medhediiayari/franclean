-- ============================================================
-- Bipbip (Franclean) — Full Database Schema
-- Generated from schema.prisma — April 3, 2026
-- 
-- Usage on VPS:
--   sudo docker compose exec postgres psql -U franclean -d franclean_db -f /dev/stdin < server/prisma/full-schema.sql
--
-- Or to nuke and recreate (WARNING: destroys all data):
--   sudo docker compose exec postgres psql -U franclean -c "DROP DATABASE franclean_db;"
--   sudo docker compose exec postgres psql -U franclean -c "CREATE DATABASE franclean_db;"
--   sudo docker compose exec postgres psql -U franclean -d franclean_db -f /dev/stdin < server/prisma/full-schema.sql
-- ============================================================

-- ── Enums ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('admin', 'agent', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('planifie', 'en_cours', 'termine', 'a_reattribuer', 'annule');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentResponse" AS ENUM ('pending', 'accepted', 'refused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('en_attente', 'valide', 'refuse', 'suspect');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Users ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
  "id"              TEXT NOT NULL,
  "firstName"       TEXT NOT NULL,
  "lastName"        TEXT NOT NULL,
  "email"           TEXT NOT NULL,
  "password"        TEXT NOT NULL,
  "phone"           TEXT NOT NULL DEFAULT '',
  "role"            "Role" NOT NULL DEFAULT 'agent',
  "avatar"          TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "canRefuseEvents" BOOLEAN NOT NULL DEFAULT true,
  "clientId"        TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_clientId_key" ON "users"("clientId");

-- ── Events ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "events" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "client"      TEXT,
  "clientPhone" TEXT,
  "site"        TEXT,
  "color"       TEXT NOT NULL DEFAULT '#6366F1',
  "startDate"   DATE NOT NULL,
  "endDate"     DATE NOT NULL,
  "address"     TEXT NOT NULL DEFAULT '',
  "latitude"    DOUBLE PRECISION,
  "longitude"   DOUBLE PRECISION,
  "geoRadius"   INTEGER NOT NULL DEFAULT 200,
  "hourlyRate"  DOUBLE PRECISION,
  "status"      "EventStatus" NOT NULL DEFAULT 'planifie',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- ── Event Agents (many-to-many with response) ──────────

CREATE TABLE IF NOT EXISTS "event_agents" (
  "id"       TEXT NOT NULL,
  "eventId"  TEXT NOT NULL,
  "agentId"  TEXT NOT NULL,
  "response" "AgentResponse" NOT NULL DEFAULT 'pending',

  CONSTRAINT "event_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_agents_eventId_agentId_key" ON "event_agents"("eventId", "agentId");

-- ── Event Shifts ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "event_shifts" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "agentId"   TEXT,
  "date"      DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime"   TEXT NOT NULL,

  CONSTRAINT "event_shifts_pkey" PRIMARY KEY ("id")
);

-- ── Event History ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "event_history" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "details"   TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "event_history_pkey" PRIMARY KEY ("id")
);

-- ── Attendances ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "attendances" (
  "id"                    TEXT NOT NULL,
  "eventId"               TEXT NOT NULL,
  "shiftId"               TEXT,
  "agentId"               TEXT NOT NULL,
  "date"                  DATE NOT NULL,
  "checkInTime"           TIMESTAMP(3),
  "checkInPhotoUrl"       TEXT,
  "checkInLatitude"       DOUBLE PRECISION,
  "checkInLongitude"      DOUBLE PRECISION,
  "checkInLocationValid"  BOOLEAN,
  "checkOutTime"          TIMESTAMP(3),
  "checkOutPhotoUrl"      TEXT,
  "checkOutLatitude"      DOUBLE PRECISION,
  "checkOutLongitude"     DOUBLE PRECISION,
  "checkOutLocationValid" BOOLEAN,
  "hoursWorked"           DOUBLE PRECISION,
  "billedHours"           DOUBLE PRECISION,
  "status"                "AttendanceStatus" NOT NULL DEFAULT 'en_attente',
  "validatedBy"           TEXT,
  "validatedAt"           TIMESTAMP(3),
  "refusalReason"         TEXT,
  "isSuspect"             BOOLEAN NOT NULL DEFAULT false,
  "suspectReasons"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- ── Attendance Photos ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "attendance_photos" (
  "id"           TEXT NOT NULL,
  "attendanceId" TEXT NOT NULL,
  "photoUrl"     TEXT NOT NULL,
  "caption"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_photos_pkey" PRIMARY KEY ("id")
);

-- ── Clients ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "clients" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "email"             TEXT,
  "phone"             TEXT,
  "address"           TEXT,
  "notes"             TEXT,
  "siret"             TEXT,
  "siren"             TEXT,
  "formeJuridique"    TEXT,
  "tvaNumber"         TEXT,
  "representantLegal" TEXT,
  "representantRole"  TEXT,
  "codeApe"           TEXT,
  "capitalSocial"     TEXT,
  "rcs"               TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clients_name_key" ON "clients"("name");

-- ── Client Sites ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_sites" (
  "id"         TEXT NOT NULL,
  "clientId"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "address"    TEXT NOT NULL DEFAULT '',
  "latitude"   DOUBLE PRECISION,
  "longitude"  DOUBLE PRECISION,
  "geoRadius"  INTEGER NOT NULL DEFAULT 200,
  "hourlyRate" DOUBLE PRECISION,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_sites_pkey" PRIMARY KEY ("id")
);

-- ── Agent Payments ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_payments" (
  "id"          TEXT NOT NULL,
  "agentId"     TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "date"        TEXT NOT NULL,
  "periodStart" TEXT NOT NULL,
  "periodEnd"   TEXT NOT NULL,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_payments_pkey" PRIMARY KEY ("id")
);

-- ── Email Notification Rules ────────────────────────────

CREATE TABLE IF NOT EXISTS "email_notification_rules" (
  "id"         TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "enabled"    BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "threshold"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_notification_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_notification_rules_type_key" ON "email_notification_rules"("type");

-- ── Email Logs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id"       TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject"  TEXT NOT NULL,
  "channel"  TEXT NOT NULL DEFAULT 'email',
  "entityId" TEXT,
  "sentAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- ── SMS Config (Twilio) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "sms_config" (
  "id"          TEXT NOT NULL DEFAULT 'singleton',
  "accountSid"  TEXT NOT NULL DEFAULT '',
  "authToken"   TEXT NOT NULL DEFAULT '',
  "phoneNumber" TEXT NOT NULL DEFAULT '',
  "enabled"     BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sms_config_pkey" PRIMARY KEY ("id")
);

-- ── Prisma Migrations Table ─────────────────────────────

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                    VARCHAR(36) NOT NULL,
  "checksum"              VARCHAR(64) NOT NULL,
  "finished_at"           TIMESTAMPTZ,
  "migration_name"        VARCHAR(255) NOT NULL,
  "logs"                  TEXT,
  "rolled_back_at"        TIMESTAMPTZ,
  "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count"   INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- ── Foreign Keys ────────────────────────────────────────

-- users.clientId → clients.id
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_clientId_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- event_agents → events, users
ALTER TABLE "event_agents" DROP CONSTRAINT IF EXISTS "event_agents_eventId_fkey";
ALTER TABLE "event_agents" ADD CONSTRAINT "event_agents_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_agents" DROP CONSTRAINT IF EXISTS "event_agents_agentId_fkey";
ALTER TABLE "event_agents" ADD CONSTRAINT "event_agents_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- event_shifts → events, users
ALTER TABLE "event_shifts" DROP CONSTRAINT IF EXISTS "event_shifts_eventId_fkey";
ALTER TABLE "event_shifts" ADD CONSTRAINT "event_shifts_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_shifts" DROP CONSTRAINT IF EXISTS "event_shifts_agentId_fkey";
ALTER TABLE "event_shifts" ADD CONSTRAINT "event_shifts_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- event_history → events, users
ALTER TABLE "event_history" DROP CONSTRAINT IF EXISTS "event_history_eventId_fkey";
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_history" DROP CONSTRAINT IF EXISTS "event_history_userId_fkey";
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- attendances → events, event_shifts, users
ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_eventId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_shiftId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "event_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_agentId_fkey";
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- attendance_photos → attendances
ALTER TABLE "attendance_photos" DROP CONSTRAINT IF EXISTS "attendance_photos_attendanceId_fkey";
ALTER TABLE "attendance_photos" ADD CONSTRAINT "attendance_photos_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_sites → clients
ALTER TABLE "client_sites" DROP CONSTRAINT IF EXISTS "client_sites_clientId_fkey";
ALTER TABLE "client_sites" ADD CONSTRAINT "client_sites_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Mark all migrations as applied ──────────────────────

INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000000', '20260320044323_firstmigration', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000001', '20260320225423_add_agent_id_to_shifts', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000002', '20260322015021_add_clients_table', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000003', '20260322021427_add_hourly_rate', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000004', '20260322122719_add_agent_payments', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000005', '20260330150939_add_site_to_events', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000006', '20260330154632_add_client_sites', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000007', '20260330180156_add_hourly_rate_to_sites', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000008', '20260330184323_add_client_juridique_fields', NOW(), 1),
  (gen_random_uuid()::varchar, '0000000000000000000000000000000000000000000000000000000000000009', '20260331154951_add_client_phone_to_event', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000a', '20260331160814_add_can_refuse_events', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000b', '20260401141618_add_billed_hours', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000c', '20260401155422_add_attendance_photos', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000d', '20260401193011_add_client_role_and_user_link', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000e', '20260403125318_add_email_notifications', NOW(), 1),
  (gen_random_uuid()::varchar, '000000000000000000000000000000000000000000000000000000000000000f', '20260403163525_add_sms_config', NOW(), 1)
ON CONFLICT DO NOTHING;

-- ── Done ────────────────────────────────────────────────
-- All tables, indexes, constraints, and enums are now in place.
-- The _prisma_migrations table is populated so Prisma won't try to re-run migrations.
