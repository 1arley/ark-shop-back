# 🚨 Production Database Migration Required

## Issue Identified

**Date:** 2026-05-14  
**Error:** `The column 'Product.imageUrl' does not exist in the current database.`  
**Impact:** `/api/products` endpoint returning 500 Internal Server Error

## Root Cause

The Prisma schema includes an `imageUrl` field on the `Product` model, and migration file `20260513135653_add_product_imageurl` exists, but **the migration has not been applied to the production database**.

## Migration Details

- **Migration File:** `prisma/migrations/20260513135653_add_product_imageurl/migration.sql`
- **SQL Command:** `ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;`
- **Status:** ✅ Migration file exists | ❌ Not applied to production

## Solution - Apply Migration to Production

### Option 1: Via Render Deployment (Recommended)

1. **Add migration command to package.json:**

```json
{
  "scripts": {
    "migrate:deploy": "prisma migrate deploy",
    "migrate:status": "prisma migrate status"
  }
}
```

2. **In Render Dashboard:**
   - Go to: [Render Dashboard - ark-shop-back](https://dashboard.render.com/)
   - Select your backend service
   - Go to **Settings** → **Environment**
   - Add pre-deploy command: `npx prisma migrate deploy`
   - Save and redeploy

### Option 2: Manual Migration via SSH/Console

If Render provides console access:

```bash
# Connect to your Render instance
# Run the migration
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Option 3: Local Migration (If you have production DB access)

```bash
# Set production DATABASE_URL (from Render environment variables)
export DATABASE_URL="postgresql://..."

# Run migration
npx prisma migrate deploy

# Verify
npx prisma db pull
```

## Verification Steps

After running the migration:

1. **Check migration status:**

```bash
npx prisma migrate status
```

2. **Test the endpoint:**

```bash
curl https://ark-shop-back.onrender.com/api/products
```

Expected response: Should return products list (200 OK) instead of 500 error

3. **Check logs in Render:**

```
https://dashboard.render.com/
→ ark-shop-back → Logs
```

## Prevention

To prevent this issue in the future:

1. **Always run migrations after deployment:**
   - Add `prisma migrate deploy` to your deployment pipeline
   - Or use Render's post-deploy hooks

2. **Update CI/CD pipeline:**

```yaml
# Example for GitHub Actions
- name: Run Prisma Migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

3. **Document in deployment checklist:**
   - [ ] Code deployed
   - [ ] Migrations run
   - [ ] Health check passed
   - [ ] Endpoints tested

## Additional Context

- **Frontend:** dark-shop (Vercel) - ✅ Deployed and working
- **Backend:** ark-shop-back (Render) - ⚠️ Migration pending
- **Database:** Supabase PostgreSQL - ✅ Connected
- **Failed Request:** `GET /api/products` - 500 error
- **Correlation ID:** `19f22803-c0ed-46ff-801d-f82d491156c1`

## Contact

If you need help with the migration, check:

- Prisma Docs: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Render Docs: https://render.com/docs/database-migrations
