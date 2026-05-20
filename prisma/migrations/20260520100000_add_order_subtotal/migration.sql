-- Add subtotal column to Order table
-- For existing rows, copy total value (subtotal = total before discount feature)
ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE "Order" SET "subtotal" = "total" WHERE "subtotal" = 0;
