# AGENTS.md — Ark Shop Backend

## Project Overview

**NestJS v11** e-commerce backend (D'Ark Games Store) with JWT authentication, Prisma ORM, PostgreSQL, Docker, and automated CI/CD.

**Node Version:** 22 (enforced by `.nvmrc`)

---

## Quick Commands

```bash
# Development
npm run start:dev          # Start with watch mode
npm run start:debug        # Debug mode with watch
npm run prisma:studio      # Open Prisma Studio

# Testing
npm run test               # Unit tests (Jest)
npm run test:e2e           # E2E tests (requires Docker)
npm run test:all           # Run all tests

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations (dev)
npm run migrate:dev        # Named migration (dev)
npm run seed               # Run seeders

# Docker
npm run docker:build       # Build Docker image
npm run docker:up          # Start containers
npm run docker:restart     # Rebuild and restart

# Code Quality
npm run lint               # ESLint check
npm run lint:fix           # ESLint auto-fix
npm run format             # Prettier format
```

---

## Architecture

### Entry Points
- **Main:** `src/main.ts` — Bootstrap, global pipes/filters/interceptors, Swagger setup
- **App Module:** `src/app.module.ts` — Imports all feature modules

### Module Structure
```
src/
├── app.module.ts          # Root module (imports all feature modules)
├── main.ts                # Bootstrap logic
├── auth/                  # JWT authentication
├── user/                  # User management
├── modules/               # Feature modules
│   ├── products/
│   ├── orders/
│   ├── payments/
│   ├── cart/
│   ├── sellers/
│   └── ...
├── common/                # Shared utilities, filters, interceptors
├── prisma/                # Prisma service wrapper
└── logger/                # Pino logger
```

### Key Dependencies
- **Database:** PostgreSQL via Prisma ORM (`@prisma/client`)
- **Authentication:** JWT (`@nestjs/jwt`, `passport-jwt`)
- **Payments:** Asaas (primary), Mercado Pago (legacy)
- **Email:** Resend
- **Logging:** Pino (`pino`, `pino-pretty`)
- **Monitoring:** Sentry, Prometheus (`prom-client`)
- **Rate Limiting:** `@nestjs/throttler`

---

## Testing

### Test Structure
- **Unit Tests:** `src/**/*.spec.ts` — Run with `npm run test`
- **E2E Tests:** `test/**/*.e2e-spec.ts` — Run with `npm run test:e2e`

### E2E Test Requirements
E2E tests require:
1. Docker Compose (`docker-compose.test.yml`)
2. Test database on port 5433
3. Environment: `.env.test`

```bash
# Run single E2E test
npx dotenv-cli -e .env.test -- npx jest --config ./test/jest-e2e.json --runInBand test/products.e2e-spec.ts

# Run checkout flow specifically
npm run test:e2e:checkout
```

### Test Setup Files
- `test/setup/e2e.setup.ts` — E2E test setup
- `test/setup/global.setup.ts` — Global test setup
- `src/tests/setup.ts` — Unit test setup

---

## Database (Prisma)

### Schema Location
- **Schema:** `prisma/schema.prisma`
- **Migrations:** `prisma/migrations/`
- **Config:** `prisma.config.ts` (exports Prisma config for CLI)

### Key Models
- `User` — Authentication and user profile
- `Product` / `Category` — Catalog
- `Order` / `OrderItem` — Orders
- `Payment` — Payment tracking
- `Key` — Digital product keys
- `Cart` / `CartItem` — Shopping cart
- `Seller` — Marketplace sellers
- `Coupon` — Discount codes

### Database Commands
```bash
# Generate Prisma client (required after schema changes)
npx prisma generate

# Create new migration (dev)
npx prisma migrate dev --name <name>

# Deploy migrations (production)
npx prisma migrate deploy

# Reset database (destructive)
npx prisma migrate reset --force
```

---

## Environment Variables

### Required Variables
See `.env.example` for template. Key variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ark_shop

# JWT
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>

# Payment (Asaas)
ASAAS_API_KEY=<key>
ASAAS_SANDBOX=true

# Email
RESEND_API_KEY=<key>
EMAIL_FROM="Store <noreply@store.com>"

# CORS (production)
CORS_ORIGIN=https://frontend.domain.com
```

### Environment Loading Order
1. `.env` (always loaded)
2. `.env.local` (development only)
3. `.env.test` (test environment only)

---

## Docker

### Images
- **Production:** `arthuriarley/ark-shop-back:latest`
- **Development:** Local build via `docker compose up --build`

### Services
- `app` — NestJS API (port 3000)
- `postgres` — PostgreSQL 16 (port 5432)
- `pgadmin` — Optional (profile: tools)

### Commands
```bash
# Start production stack
docker compose up -d

# Build and start (development)
docker compose up --build

# Rebuild from scratch
docker compose down -v --rmi local
docker compose up -d --build
```

---

## CI/CD

### GitHub Actions Workflows
1. **CI** (`.github/workflows/ci.yml`)
   - Lint, unit tests, E2E tests, Docker build, security scan (Trivy)
   - Runs on PRs to `main`/`dev` and pushes to `dev`

2. **Release** (`.github/workflows/release.yml`)
   - Semantic release, changelog, Docker push
   - Runs on pushes to `main`/`dev`

3. **Deploy** (`.github/workflows/deploy.yml`)
   - Deploy to staging (auto from `dev`)
   - Deploy to production (manual trigger or release tag)

### Pre-commit Hooks
Husky runs on every commit:
- `prisma format --check`
- `npm run lint`
- lint-staged (ESlint + Prettier on staged files)

---

## Code Style & Conventions

### Linting
- **ESLint:** `eslint.config.mjs` (flat config)
- **Prettier:** `.prettierrc`
- **TypeScript:** strict mode enabled

### Key Rules
- Single quotes, trailing commas, 2-space tabs, 100 char line width
- `no-explicit-any`: warn (NestJS uses `any` in decorators)
- `no-floating-promises`: error (with `void` escape hatch)
- Unsafe type checks: warn (NestJS/Prisma patterns)

### Path Aliases
```typescript
import { x } from '@/utils/foo';      // src/utils/foo
import { y } from '@/modules/bar';    // src/modules/bar
import { z } from '@/common/baz';     // src/common/baz
```

---

## Authentication Flow

### JWT Strategy
1. User registers → email verification required
2. Login returns access token (15min) + refresh token (7d)
3. Access token in `Authorization: Bearer <token>`
4. Refresh token in HTTP-only cookie

### Roles
- `USER` — Default role
- `ADMIN` — Admin access
- `SUPERADMIN` — Full access

### Security Features
- Rate limiting (Throttler)
- Helmet (security headers)
- CORS (strict in production)
- Request size limits (1mb)

---

## Payment Integration

### Primary: Asaas
- PIX, credit card, debit card, boleto
- Webhook-based payment confirmation
- Split payments for marketplace

### Legacy: Mercado Pago
- Maintained for backward compatibility
- Fallback if Asaas unavailable

---

## Common Gotchas

### Prisma Binary Targets
Schema includes `rhel-openssl-3.0.x` for Lambda/serverless compatibility.

### Raw Body for Webhooks
Payment webhooks require `rawBody` for signature verification:
```typescript
// In main.ts
rawBody: true,

// In controller
@RawBody()
```

### Environment Validation
`src/config/env.validation.ts` validates required env vars. Missing vars will crash startup.

### Swagger (Development Only)
Swagger UI available at `/api/docs` in development. Disabled in production.

### Health Checks
- `/api/health/live` — Liveness probe
- `/api/health/ready` — Readiness probe (includes database check)

---

## Testing Guidelines

### Unit Tests
- Use `jest.config.mjs` (rootDir: `src`)
- Mock Prisma with `@prisma/client` mocks
- Test files: `*.spec.ts`

### E2E Tests
- Use `test/jest-e2e.json` (rootDir: `test`)
- Require running database (Docker)
- Test files: `*.e2e-spec.ts`
- Use `--runInBand` flag (sequential execution)

### Coverage Threshold
CI enforces minimum 30% line coverage.

---

## Deployment

### Staging
- Branch: `dev`
- Image tag: `dev`
- Trigger: Automatic on push

### Production
- Branch: `main`
- Image tag: `latest` or version tag
- Trigger: Manual or release tag

### Render Deployment
Uses deploy hooks for zero-downtime deployments. Environment variables must be configured in Render dashboard.

---

## File Conventions

### Naming
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Modules: `*.module.ts`
- DTOs: `create-*.dto.ts`, `update-*.dto.ts`
- Interfaces: `*.interface.ts`
- Enums: `*.enum.ts`

### DTOs
Use `class-validator` decorators:
```typescript
import { IsString, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

---

## Troubleshooting

### Prisma Client Not Generated
```bash
npx prisma generate
```

### Database Connection Issues
1. Check `.env` has correct `DATABASE_URL`
2. Verify PostgreSQL is running: `docker ps`
3. Test connection: `docker compose exec postgres pg_isready`

### Port Already in Use
Change `PORT` in `.env` or stop existing container:
```bash
docker compose down
```

### Tests Failing with "Cannot find module"
Run `npm run prisma:generate` first.

### Lint Errors in CI
Run `npm run lint:fix` locally before committing.

---

## Security Notes

### Secrets Management
- Never commit `.env` files
- Use GitHub Secrets for CI/CD
- Rotate JWT secrets regularly

### CORS in Production
Production blocks all CORS unless `CORS_ORIGIN` is explicitly configured. Wildcards (`*`) are rejected.

### Rate Limiting
Throttler is active in production. Adjust limits in `@Throttle()` decorators per route.

---

## References

- **Prisma Schema:** `prisma/schema.prisma`
- **Environment Template:** `.env.example`
- **Docker Config:** `docker-compose.yml`, `Dockerfile`
- **CI Config:** `.github/workflows/`
- **Code Conventions:** `docs/code-conventions.md`
- **Authentication:** `docs/authentication.md`
- **Docker Guide:** `docs/docker.md`
