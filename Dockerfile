# ============================================
# D'Ark Games Store — Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Base
FROM node:26-bookworm-slim AS base

RUN apt-get update && \
    apt-get dist-upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends \
        dumb-init wget ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Stage 2: Dependencies (production only)
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 3: Build
FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma/
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma.config.ts ./
COPY src ./src/
RUN npm run build

# Stage 4: Production
FROM base AS production

# Cache bust: forces apt-get to re-run on every CI build
ARG CACHE_BUST
RUN echo "Cache bust: ${CACHE_BUST}" && \
    apt-get update && \
    apt-get dist-upgrade -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/health/ready || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
