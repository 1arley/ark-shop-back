# ============================================
# D'Ark Games Store — Production Dockerfile
# Multi-stage with BuildKit cache mounts
# ============================================
# Build: docker build -t ark-shop .
# Requires BuildKit: DOCKER_BUILDKIT=1 (default on Docker 23+)

# ────────────────────────────────────────────
# Stage 1: Base (shared by deps + build)
# ────────────────────────────────────────────
FROM node:22-bookworm-slim AS base

RUN apt-get update && \
    apt-get dist-upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends \
        dumb-init ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# ────────────────────────────────────────────
# Stage 2: Dependencies (production only)
# Caches npm and prisma engines across builds
# ────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
# Cache mount avoids re-downloading on every rebuild
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# ────────────────────────────────────────────
# Stage 3: Build (full deps + prisma generate + nest build)
# ────────────────────────────────────────────
FROM base AS build

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

COPY prisma ./prisma/
# Dummy URL — only needed for generate, not actual connection
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN --mount=type=cache,target=/root/.npm \
    npx prisma generate --schema=./prisma/schema.prisma

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma.config.ts ./
COPY src ./src/
RUN npm run build

# ────────────────────────────────────────────
# Stage 4: Runtime (minimal)
# No build tools, no apt-get, only what's needed to run
# ────────────────────────────────────────────
FROM base AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    # Cap Node heap at 384MB so it respects container limits and GCs early
    NODE_OPTIONS="--max-old-space-size=384"

COPY --from=base /usr/bin/dumb-init /usr/bin/dumb-init
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=node:node --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

USER node

EXPOSE 3000

# Node-based healthcheck — no wget needed, avoids extra apt deps
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
