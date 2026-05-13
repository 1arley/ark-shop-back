-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN "pixKey" TEXT;
CREATE UNIQUE INDEX "Seller_asaasAccountId_key" ON "Seller"("asaasAccountId");
