# D'Ark Games Store — Agent Quick Reference

## Commands (from package.json)

```bash
npm run start:dev       # Dev server with watch (nest start --watch)
npm run lint            # eslint {src,test}/**/*.ts
npm run test            # Unit tests (jest.config.mjs, tests *.spec.ts in src/)
npm run test:unit       # Same as test
npm run test:e2e        # E2E wrapper: docker up → prisma generate → db push → jest --config test/jest-e2e.json
npm run test:cov        # Unit tests with coverage
npm run prisma:generate # npx prisma generate
npm run prisma:migrate  # npx prisma migrate dev
npm run prisma:studio   # npx prisma studio
npm run seed            # ts-node prisma/seed.ts
npm run docker:up       # docker compose up -d  (service: app only; postgres is commented out in docker-compose.yml)
npm run docker:down     # docker compose down
npm run docker:test     # Build + run E2E in container (docker-compose.test.yml)
npm run format          # prettier --write src/** test/**
```

## Architecture

- **Framework:** NestJS 11 + TypeScript, PostgreSQL via Prisma ORM 7
- **Auth:** JWT access+refresh tokens (Passport strategies in `src/auth/`)
- **API Docs:** Swagger at `/api/docs`
- **Path aliases (tsconfig):** `@/*` → `src/*`, `~/*` → `src/*`, `@utils/*` → `src/utils/*`, `@test/*` → `test/*`
- **Module split:** `src/auth/` and `src/user/` live directly in `src/`; all business modules (products, keys, orders, payments, categories, admin, cart, antifraud, email) live under `src/modules/`
- **Key models:** User → Order → OrderItems → Product → Key; Order → Payment
- **Keys encrypted at rest** (AES-256) — never store plaintext
- **Redis (BullMQ)** for queues (email), configured with `lazyConnect: true` — app starts without Redis

## Testing

- **Unit tests** (`*.spec.ts` alongside source): jest.config.mjs — rootDir = `src/`, no DB needed
- **E2E tests** (`*.e2e-spec.ts` in `test/`): test/jest-e2e.json (not jest-e2e.config.js). Needs PostgreSQL. Two ways to run:
  - Local: `npm run test:e2e` — wrapper script starts docker, pushes schema, runs jest, cleans up
  - Manual: `docker compose -f docker-compose.test.yml up -d`, then `npx dotenv-cli -e .env.test -- npx jest --config test/jest-e2e.json --runInBand --forceExit`
- CI order (ci.yml): `npm ci` → `prisma generate` → `npm run lint` → `npm test` (unit) or `jest --config test/jest-e2e.json` (E2E)
- **Note:** `jest-e2e.config.js` at root is unused (stale from refactor). E2E config lives in `test/jest-e2e.json`

## Conventions & Gotchas

- **Node 22 required** (.nvmrc)
- **Husky pre-commit:** `npx lint-staged` → eslint --fix + prettier --write on staged _.ts, prettier --write on _.json/\*.md
- **Husky commit-msg:** `npx commitlint` — conventional commits required (feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert)
- **Semantic release** from `main` (production) and `dev` (prerelease) branches. `npm run release` executes it.
- **Env:** `.env`, `.env.local`, `.env.test` loaded (in that priority). CI uses `dotenv-cli -e .env.test` before commands.
- **Vercel:** `api/index.js` + `vercel.json`. Vercel serverless handler lazy-bootstraps NestJS and caches Express instance across warm invocations. `main.ts` exports `createApp()` used by both local dev (`listen()`) and Vercel (handler export). `build` script runs `prisma generate && nest build` — Prisma 7 auto-detects `prisma.config.ts` (no `--config-name` flag).
- **CORS_ORIGIN** warn (not throw) in production — app starts even if unset
- **Prettier**: singleQuote, trailingComma: all, printWidth: 100, arrowParens: avoid, endOfLine: lf (but ESLint rule overrides to `auto`)
- **`prisma generate` required after any schema change.** Build (Dockerfile) generates Prisma client separately as a build stage step
- **typecheck:** No dedicated `typecheck` script — rely on `nest build` or tsc via IDE
- **Lint rules:** `no-explicit-any` and no-unsafe-\* rules are `warn` (not `error`) to accommodate NestJS patterns. `no-floating-promises` is `error` (unless void). Relaxed rules for test files
- **Renaming conventions** for tests: `.spec.ts` for unit (collocated), `.e2e-spec.ts` for E2E (in `test/`)
