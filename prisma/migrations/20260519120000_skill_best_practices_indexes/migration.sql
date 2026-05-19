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

-- Cart: one row per product per cart
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");
