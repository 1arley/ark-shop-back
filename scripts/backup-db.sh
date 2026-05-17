#!/usr/bin/env bash
#
# Backup PostgreSQL database (Supabase) and upload to Supabase Storage.
#
# Usage:
#   ./scripts/backup-db.sh
#
# Requirements:
#   - pg_dump installed
#   - curl installed
#   - DATABASE_URL and S3 credentials in .env
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

# ─── Configuration ─────────────────────────────────────────────────
BACKUP_DIR="/tmp/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ark-shop-backup-${TIMESTAMP}.sql.gz"
BUCKET="${S3_BUCKET:-ark-shop-images}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_ACCESS_KEY="${S3_ACCESS_KEY_ID:-}"
S3_SECRET_KEY="${S3_SECRET_ACCESS_KEY:-}"
S3_REGION="${S3_REGION:-us-east-2}"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting database backup..."
echo "   Timestamp: $TIMESTAMP"
echo "   Output: $BACKUP_DIR/$BACKUP_FILE"

# ─── Dump database ─────────────────────────────────────────────────
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$BACKUP_DIR/$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "✅ Backup created: $BACKUP_SIZE"

# ─── Upload to Supabase Storage (if S3 configured) ─────────────────
if [ -n "$S3_ACCESS_KEY" ] && [ -n "$S3_SECRET_KEY" ]; then
  echo "☁️  Uploading to Supabase Storage..."

  # Use AWS CLI or mc (MinIO Client) if available, otherwise use curl
  if command -v aws &> /dev/null; then
    AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
    AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
    AWS_DEFAULT_REGION="$S3_REGION" \
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" \
      "s3://$BUCKET/backups/$BACKUP_FILE" \
      --endpoint-url "$S3_ENDPOINT"
    echo "✅ Uploaded to s3://$BUCKET/backups/$BACKUP_FILE"
  elif command -v mc &> /dev/null; then
    mc alias set supabase "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
    mc cp "$BACKUP_DIR/$BACKUP_FILE" "supabase/$BUCKET/backups/$BACKUP_FILE"
    echo "✅ Uploaded to supabase/$BUCKET/backups/$BACKUP_FILE"
  else
    echo "⚠️  Neither 'aws' nor 'mc' CLI found. Backup saved locally only."
    echo "   Install AWS CLI or MinIO Client for automatic upload."
  fi
else
  echo "⚠️  S3 credentials not configured. Backup saved locally only."
fi

# ─── Cleanup old local backups (keep last 7) ───────────────────────
echo "🧹 Cleaning up old backups..."
ls -t "$BACKUP_DIR"/ark-shop-backup-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "🎉 Backup completed successfully!"
echo "   File: $BACKUP_DIR/$BACKUP_FILE"
