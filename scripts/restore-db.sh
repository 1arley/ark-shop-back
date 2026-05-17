#!/usr/bin/env bash
#
# Restore PostgreSQL database (Supabase) from a backup file.
#
# Usage:
#   ./scripts/restore-db.sh [backup-file.sql.gz]
#
# If no file is specified, uses the latest backup from /tmp/db-backups/.
#
# ⚠️  WARNING: This will OVERWRITE the current database!
#
set -euo pipefail

# ─── Load environment ──────────────────────────────────────────────
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set in .env"
  exit 1
fi

# ─── Find backup file ──────────────────────────────────────────────
BACKUP_DIR="/tmp/db-backups"

if [ $# -gt 0 ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/ark-shop-backup-*.sql.gz 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No backup files found in $BACKUP_DIR"
    echo "Usage: ./scripts/restore-db.sh <backup-file.sql.gz>"
    exit 1
  fi
  echo "Using latest backup: $BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

# ─── Confirm ───────────────────────────────────────────────────────
echo "⚠️  WARNING: This will OVERWRITE the current database!"
echo "   Database: $(echo "$DATABASE_URL" | sed 's|://.*@|://***@|')"
echo "   Backup: $BACKUP_FILE"
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Cancelled."
  exit 0
fi

# ─── Restore ───────────────────────────────────────────────────────
echo "🔄 Restoring database..."

# Drop and recreate public schema to ensure clean state
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true

# Restore from backup
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "🎉 Database restored successfully!"
