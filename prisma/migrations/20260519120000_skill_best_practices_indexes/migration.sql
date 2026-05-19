-- Performance indexes (Postgres best practices / Prisma skill guidelines)

-- RefreshToken: session lookup and expiry cleanup
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- Password reset / email verification: active token lookups
CREATE INDEX "PasswordResetToken_userId_usedAt_expiresAt_idx" ON "PasswordResetToken"("userId", "usedAt", "expiresAt");
CREATE INDEX "EmailVerificationToken_userId_usedAt_expiresAt_idx" ON "EmailVerificationToken"("userId", "usedAt", "expiresAt");

-- Payments & antifraud reporting
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "FraudLog_createdAt_idx" ON "FraudLog"("createdAt");
CREATE INDEX "FraudLog_riskLevel_idx" ON "FraudLog"("riskLevel");

-- RefreshToken: persist remember-me sessions explicitly (replaces expiry heuristic)
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "rememberMe" BOOLEAN NOT NULL DEFAULT false;

-- Cart: merge duplicates then enforce one row per (cartId, productId)
WITH ranked AS (
  SELECT
    id,
    SUM(quantity) OVER (PARTITION BY "cartId", "productId") AS total_qty,
    ROW_NUMBER() OVER (PARTITION BY "cartId", "productId" ORDER BY "createdAt" ASC) AS rn
  FROM "CartItem"
)
UPDATE "CartItem" AS c
SET quantity = r.total_qty
FROM ranked AS r
WHERE c.id = r.id AND r.rn = 1;

DELETE FROM "CartItem"
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY "cartId", "productId" ORDER BY "createdAt" ASC) AS rn
    FROM "CartItem"
  ) AS duplicates
  WHERE rn > 1
);

CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");
