-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "asaasAccountId" TEXT;
ALTER TABLE "Seller" ADD COLUMN "asaasWalletId" TEXT;
ALTER TABLE "Seller" ADD COLUMN "pixKey" TEXT;
CREATE UNIQUE INDEX "Seller_asaasAccountId_key" ON "Seller"("asaasAccountId");
