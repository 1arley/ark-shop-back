-- Adiciona coluna subtotal na tabela Order
-- Para linhas existentes, copia o valor de total (subtotal = total antes do feature de desconto)
ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE "Order" SET "subtotal" = "total" WHERE "subtotal" = 0;
