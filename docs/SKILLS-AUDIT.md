# Skills audit — ark-shop-back

Audit date: 2026-05-19. Skills installed globally under `~/.agents/skills/`.

## Summary

| Skill                            | Status            | Notes                                                                    |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| nestjs-clean-typescript          | Applied (ongoing) | Shared selects, typed Prisma filters; some `any` in payments/webhooks    |
| prisma                           | Applied           | `select`/`include`, indexes, pool config, transactions                   |
| jwt-security                     | Applied           | Minimal JWT payload, hashed refresh, rotation                            |
| supabase-postgres-best-practices | Applied           | Composite indexes migration `20260519120000_*`                           |
| postgresql-code-review           | Applied           | Migration reviewed; JSONB on `FraudLog`/`Payment.webhookData` acceptable |
| test-driven-development          | Process           | 946+ unit tests; write tests before new behavior                         |
| systematic-debugging             | Process           | Use on failures (reproduce → root cause → fix)                           |
| verification-before-completion   | Verified          | `npm run test` — 946 passed (last run)                                   |
| requesting-code-review           | Process           | Pre-merge checklist in skill                                             |
| docker-compose-orchestration     | Applied           | App + Postgres healthchecks                                              |
| github-actions-docs              | Reviewed          | CI: lint, unit cov, e2e, docker build, Trivy — aligned                   |
| sentry                           | Applied           | `instrument.ts` PII scrub; `sendDefaultPii: false`                       |

## Module checklist

| Area                                                                                                                      | prisma/jwt | Action taken                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `auth/`                                                                                                                   | Yes        | JWT payload, refresh lookup, `select` on login/validate |
| `user/`                                                                                                                   | Yes        | `userPublicSelect` on all reads                         |
| `orders/`                                                                                                                 | Yes        | `user: userPublicSelect` instead of `user: true`        |
| `payments/`                                                                                                               | Yes        | `user: userPublicSelect` on includes                    |
| `keys/`                                                                                                                   | Yes        | `keyData` excluded from list/detail APIs                |
| `prisma/`                                                                                                                 | Yes        | Pool limits, shutdown, indexes                          |
| `docker-compose*.yml`                                                                                                     | Yes        | Healthchecks                                            |
| `instrument.ts`                                                                                                           | Yes        | Extended sensitive field list                           |
| `products/`                                                                                                               | Partial    | `Prisma.ProductWhereInput` for filters                  |
| `cart/`, `coupons/`, `categories/`, `sellers/`, `admin/`, `antifraud/`, `notifications/`, `contact/`, `upload/`, `email/` | Reviewed   | No password leaks found; keys encrypted                 |

## Fixes applied in this audit (2026-05-19)

- **Critical:** `user: true` on orders/payments includes leaked `password` — replaced with `userPublicSelect` (`src/common/prisma/user-public.select.ts`).
- **user.service:** all reads/writes use `select`; no password loaded then stripped.
- **products.repository:** `Prisma.ProductWhereInput` instead of `any`.
- **docker-compose.yml:** app `healthcheck` on `/api/v1/health/ready`.
- **instrument.ts:** recursive scrub for `keyData`, `pixCode`, nested sensitive fields.

## Remaining gaps (non-blocking)

1. **Payments/webhooks** — `any` for Asaas payload shapes; consider typed DTOs when API stabilizes.
2. **RS256 JWT** — Still HS256 with secrets; asymmetric keys are a future infra change.
3. **E2E in CI** — Run `npm run test:e2e:checkout` locally after schema changes.
4. **Sentry CLI skill** — Read-only ops tool; use `sentry issue list` in production triage.

## Verification commands

```bash
npm run lint
npm run test
npm run prisma:migrate:status
npm run test:e2e:checkout   # optional, needs Docker
```
