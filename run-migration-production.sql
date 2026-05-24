# Migracao do Banco de Dados - Correcao do Erro 500

# Problema
# O endpoint /api/products esta retornando erro 500 porque a coluna `imageUrl` 
# na tabela `Product` ainda nao foi aplicada no banco de dados production.

# Solucao: Voce precisa rodar a migration no banco de dados production da Supabase

# PASSO A PASSO:

# 1. Acesse o Supabase Dashboard:
#    https://supabase.com/dashboard/project/beqrwcxgtcqizzbdldpr

# 2. Va para a secao SQL Editor ou use o psql localmente

# 3. Execute este comando SQL diretamente no banco de dados production:
#    ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

# 4. Verifique se a coluna foi criada:
#    SELECT column_name, data_type 
#    FROM information_schema.columns 
#    WHERE table_name = 'Product' AND column_name = 'imageUrl';

# 5. Teste o endpoint:
#    curl https://ark-shop-back.onrender.com/api/products

# Alternativa via Prisma CLI (se tiver a DATABASE_URL):
# npx prisma migrate deploy

# Ou adicione no .env.production:
# DATABASE_URL="postgresql://postgres.beqrwcxgtcqizzbdldpr:[SUA-SENHA]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# E rode:
# npx prisma migrate deploy
