#!/bin/sh
# ============================================
# D'Ark Games Store - Production Entrypoint
# ============================================
set -e

echo "→ Running database migrations..."

# Try to apply pending migrations
MIGRATE_OUTPUT=$(npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || true)

# ─── Case 1: No pending migrations or all applied ────────────
if echo "$MIGRATE_OUTPUT" | grep -q "No pending migrations\|All migrations have been successfully applied"; then
  echo "✓ Database is up to date."
  exec "$@"
fi

# ─── Case 2: Failed migration detected (P3009 or P3018) ─────
if echo "$MIGRATE_OUTPUT" | grep -q "P3009\|P3018"; then
  echo "⚠️  Failed migration detected. Attempting to resolve..."

  for migration_dir in prisma/migrations/*/; do
    migration_name=$(basename "$migration_dir")
    if echo "$MIGRATE_OUTPUT" | grep -q "$migration_name"; then
      echo "   Resolving: $migration_name"
      npx prisma migrate resolve --applied "$migration_name" --schema=./prisma/schema.prisma 2>/dev/null || true
    fi
  done

  echo "→ Retrying migrations after resolution..."
  if npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 | grep -q "All migrations have been successfully applied\|No pending migrations"; then
    echo "✓ Migrations applied successfully after resolution."
    exec "$@"
  fi

  # FAIL instead of --accept-data-loss: production data loss is unacceptable
  echo "❌ Migration failed after resolution attempt."
  echo "   Manual intervention required. Run:"
  echo "   npx prisma migrate resolve --applied <migration_name>"
  echo "   npx prisma migrate deploy"
  exit 1
fi

# ─── Case 3: Unexpected error ────────────────────────────────
echo "⚠️  Unexpected migration output: $MIGRATE_OUTPUT"
echo "❌ Database migration failed. Manual intervention required."
exit 1

# ─── Safety fallthrough ───────────────────────────────────────
echo "✓ Starting application..."
exec "$@"
