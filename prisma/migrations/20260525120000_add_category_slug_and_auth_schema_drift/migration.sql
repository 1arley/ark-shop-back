-- Bring the database in line with the current Prisma schema.

-- Category.slug is required by the API and seed data. Existing categories get a
-- deterministic slug before the column is marked as required.
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "slug" TEXT;

WITH candidate_slugs AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(
        regexp_replace(
          regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)',
          '',
          'g'
        ),
        ''
      ),
      'category'
    ) AS "baseSlug"
  FROM "Category"
  WHERE "slug" IS NULL
),
deduplicated_slugs AS (
  SELECT
    "id",
    CASE
      WHEN count(*) OVER (PARTITION BY "baseSlug") > 1
        THEN "baseSlug" || '-' || left("id", 8)
      ELSE "baseSlug"
    END AS "slug"
  FROM candidate_slugs
)
UPDATE "Category"
SET "slug" = deduplicated_slugs."slug"
FROM deduplicated_slugs
WHERE "Category"."id" = deduplicated_slugs."id"
  AND "Category"."slug" IS NULL;

ALTER TABLE "Category" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- User fields used by the current auth/payment integration.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_asaasCustomerId_key" ON "User"("asaasCustomerId");
CREATE INDEX IF NOT EXISTS "User_asaasCustomerId_idx" ON "User"("asaasCustomerId");

-- Temporary registrations for email verification before creating a User.
CREATE TABLE IF NOT EXISTS "PendingRegistration" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT,
  "avatarUrl" TEXT,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_email_key" ON "PendingRegistration"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "PendingRegistration_code_key" ON "PendingRegistration"("code");
CREATE INDEX IF NOT EXISTS "PendingRegistration_email_idx" ON "PendingRegistration"("email");
CREATE INDEX IF NOT EXISTS "PendingRegistration_code_idx" ON "PendingRegistration"("code");
CREATE INDEX IF NOT EXISTS "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");

-- Audit trail for account deletion.
CREATE TABLE IF NOT EXISTS "UserDeletionLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedBy" TEXT NOT NULL,

  CONSTRAINT "UserDeletionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDeletionLog_userId_key" ON "UserDeletionLog"("userId");
CREATE INDEX IF NOT EXISTS "UserDeletionLog_userId_idx" ON "UserDeletionLog"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserDeletionLog_userId_fkey'
  ) THEN
    ALTER TABLE "UserDeletionLog"
      ADD CONSTRAINT "UserDeletionLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
