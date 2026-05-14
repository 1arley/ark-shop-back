# 🚨 Como Corrigir o Erro 500 no /api/products

## Resumo do Problema

Seu backend (`https://ark-shop-back.onrender.com/api/products`) está retornando erro 500 porque falta uma coluna no banco de dados.

**Erro específico:**

```
The column `Product.imageUrl` does not exist in the current database.
```

## ✅ Solução Rápida (Escolha UMA opção)

### Opção 1: Via Supabase SQL Editor (Mais Fácil - Recomendado)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Projeto: `beqrwcxgtcqizzbdldpr` (ark-shop-back)

2. **Vá para SQL Editor:**
   - No menu lateral, clique em **SQL Editor**
   - Clique em **New Query**

3. **Execute este comando SQL:**

```sql
-- Adiciona coluna imageUrl na tabela Product
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
```

4. **Verifique se funcionou:**

```sql
-- Verifica se a coluna existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Product'
  AND column_name = 'imageUrl';
```

5. **Teste o endpoint:**
   - Acesse: https://ark-shop-back.onrender.com/api/products
   - Deve retornar status 200 (sucesso)

---

### Opção 2: Via Render Deployment (Automático)

Se preferir fazer via deployment do Render:

1. **Adicione no Render Dashboard:**
   - Vá em: https://dashboard.render.com/
   - Selecione: `ark-shop-back`
   - Settings → Environment Variables
   - Adicione: `RUN_MIGRATIONS=true`

2. **No seu código, adicione pré-deploy:**

```bash
npx prisma migrate deploy
```

3. **Redeploy no Render**

---

### Opção 3: Via Terminal Local (Se tiver DATABASE_URL)

Se você tem a DATABASE_URL completa (com senha):

```bash
# 1. Instale as dependências (se ainda não fez)
npm install

# 2. Gere o Prisma Client
npx prisma generate

# 3. Rode a migration
npx prisma migrate deploy

# 4. Verifique o status
npx prisma migrate status
```

**Importante:** Você precisa da DATABASE_URL completa do Supabase:

```
postgresql://postgres.beqrwcxgtcqizzbdldpr:[SUA-SENHA]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

Para pegar a senha:

1. Vá em: https://supabase.com/dashboard/project/beqrwcxgtcqizzbdldpr/settings/database
2. Copie a connection string
3. Substitua `[SUA-SENHA]` pela sua senha real

---

## 🔍 Como Verificar se Funcionou

### 1. Teste o endpoint diretamente:

```bash
curl -X GET "https://ark-shop-back.onrender.com/api/products"
```

**Sucesso:** Retorna JSON com lista de produtos (status 200)  
**Erro:** Retorna status 500 com mensagem de erro

### 2. Verifique os logs no Render:

1. Acesse: https://dashboard.render.com/
2. Selecione `ark-shop-back`
3. Abra a aba **Logs**
4. Procure por erros relacionados a `Product.imageUrl`

### 3. Teste pelo navegador:

Acesse: https://ark-shop-back.onrender.com/api/products

Deve aparecer uma lista de produtos ou `{ "data": [], "meta": {...} }` se não houver produtos.

---

## 📋 Scripts Adicionados ao package.json

Foram adicionados estes scripts para facilitar migrations futuras:

```json
{
  "scripts": {
    "prisma:migrate:deploy": "npx prisma migrate deploy",
    "prisma:migrate:status": "npx prisma migrate status"
  }
}
```

---

## 🛡️ Prevenção para o Futuro

Para evitar este problema em deployments futuros:

### 1. Adicione migração automática no Render:

No arquivo `.render.yaml` ou nas settings do Render:

```yaml
buildCommand: npm install && npx prisma generate
startCommand: npx prisma migrate deploy && npm run start:prod
```

### 2. Ou use GitHub Actions:

```yaml
- name: Run Prisma Migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 3. Checklist de Deploy:

- [ ] Código foi deployado
- [ ] Migrations foram rodadas
- [ ] Health check passou
- [ ] Endpoints testados

---

## 📞 Precisa de Ajuda?

- **Supabase Docs:** https://supabase.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Render Docs:** https://render.com/docs

---

**Data:** 2026-05-14  
**Status:** Aguardando execução da migration  
**Impacto:** Endpoint `/api/products` indisponível
