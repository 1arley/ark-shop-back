#!/bin/sh
# ============================================
# D'Ark Games Store - Production Entrypoint
# ============================================
# Migrations run inside the Node.js process (see src/migrate.ts)
# to avoid spawning a separate Prisma CLI process and save RAM.
# ============================================
exec "$@"