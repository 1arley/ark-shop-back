-- Prisma Migration to add imageUrl column to Product table
-- This migration was created on 2026-05-13 but needs to be applied to production

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
