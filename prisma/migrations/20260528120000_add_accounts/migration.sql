-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('KEY', 'ACCOUNT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'KEY';

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "KeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "orderItemId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_orderItemId_key" ON "Account"("orderItemId");

-- CreateIndex
CREATE INDEX "Account_productId_idx" ON "Account"("productId");

-- CreateIndex
CREATE INDEX "Account_status_idx" ON "Account"("status");

-- CreateIndex
CREATE INDEX "Account_orderItemId_idx" ON "Account"("orderItemId");

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "accountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_accountId_key" ON "OrderItem"("accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
