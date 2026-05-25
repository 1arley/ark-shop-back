# 🚀 Ark Shop — NestJS Backend

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-v11.0.1-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.7.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-v6.16.3-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)

[![CI](https://github.com/ark-shop/ark-shop-back/actions/workflows/ci.yml/badge.svg)](https://github.com/ark-shop/ark-shop-back/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/ark-shop/ark-shop-back/branch/main/graph/badge.svg)](https://codecov.io/gh/ark-shop/ark-shop-back)

</div>

---

## 📖 Overview
**Ark Shop** is a production‑ready e‑commerce backend built with **NestJS v11**, **TypeScript**, and **Prisma ORM**. It provides a complete set of REST endpoints for:
- User registration, JWT authentication (access + refresh tokens stored as HTTP‑only cookies) and role‑based access control (USER, ADMIN, SUPERADMIN).
- Product catalog, categories, digital keys, and coupon/discount handling.
- Shopping cart persistence per user.
- Order processing and payment integration (primary **Asaas**, legacy **Mercado Pago**).
- Marketplace sellers with commission logic.
- Health‑check endpoints, Swagger UI (dev only), structured logging (Pino), and observability (Sentry + Prometheus).

All components are wired together following SOLID principles, strict TypeScript configuration, and comprehensive test coverage.

---

## 🛠️ Tech Stack
- **Framework** – NestJS v11 (modular, DI‑based, testable).
- **Language** – TypeScript v5 (strict mode enabled).
- **Database** – PostgreSQL 15 (via Prisma v7).
- **Authentication** – JWT (access 15 min, refresh 7 days) with httpOnly cookies.
- **Payments** – Asaas (primary) + Mercado Pago (fallback).
- **Email** – Resend.
- **Logging** – Pino + Pino‑pretty (JSON → pretty).
- **Observability** – Sentry, Prometheus (`prom-client`).
- **Rate limiting** – `@nestjs/throttler`.
- **Containerization** – Docker (multi‑stage, non‑root user, minimal layers).
- **CI/CD** – GitHub Actions (lint, unit/E2E tests, Docker build, Trivy scan, semantic‑release).

---

## ✨ Features
- **User management** – sign‑up, email verification, role‑based guards.
- **Product management** – CRUD, categories, digital keys (API keys).
- **Cart** – add/remove items, quantity updates, persistence across sessions.
- **Orders & payments** – create order, webhook handling, split payments for marketplace.
- **Marketplace** – seller registration, commission calculation.
- **Coupon system** – creation, validation, usage tracking.
- **Swagger UI** – available at `/api/docs` in development.
- **Health checks** – `/api/health/live` (liveness) and `/api/health/ready` (readiness with DB check).
- **Testing** – unit tests (Jest) + end‑to‑end tests with Docker Compose.
- **Security** – Helmet, input validation (class‑validator), rate limiting, secure secret handling.

---

## 🚀 Quick Start (development)
```bash
# 1. Clone the repo
git clone https://github.com/ark-shop/ark-shop-back.git && cd ark-shop-back

# 2. Install dependencies (npm ci respects package‑lock)
npm ci

# 3. Create .env from the example and edit the required values
cp .env.example .env
#   - Set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ASAAS_API_KEY, RESEND_API_KEY, etc.

# 4. Generate Prisma client (required after any schema change)
npm run prisma:generate

# 5. Start the Docker stack (PostgreSQL + optional pgAdmin)
npm run docker:up

# 6. Run the NestJS app in watch mode
npm run start:dev
```
The API will be reachable at **http://localhost:3000**. Swagger UI (dev) lives at **http://localhost:3000/api/docs**.

---

## 📦 NPM Scripts
| Script | What it does |
|--------|--------------|
| `npm run build` | Generates Prisma client, compiles NestJS, fixes TS path aliases. |
| `npm run start` | Runs the compiled app (`node dist/main`). |
| `npm run start:dev` | NestJS in watch mode (hot‑reload). |
| `npm run lint` / `npm run lint:fix` | ESLint checks / auto‑fix. |
| `npm run format` | Prettier formatting. |
| `npm run test` | Executes unit tests. |
| `npm run test:e2e` | Runs full end‑to‑end suite (Docker‑compose test DB). |
| `npm run docker:build` | Builds Docker image (`arthuriarley/ark-shop-back:latest`). |
| `npm run docker:up` | Brings up Docker Compose stack (app + PostgreSQL). |
| `npm run docker:restart` | Re‑creates containers (down → up --build). |
| `npm run docker:clean` | Stops containers and removes local images/volumes. |
| `npm run docker:pgadmin` | Starts pgAdmin UI (useful for DB browsing). |

---

## 🗝️ Environment Variables
Copy **`.env.example`** to **`.env`** and fill in the values:
- `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://postgres:postgres@localhost:5432/ark-shop_db`).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` – strong random strings (use `openssl rand -hex 32`).
- `ASAAS_API_KEY` & `ASAAS_SANDBOX` – Asaas payment gateway credentials.
- `RESEND_API_KEY` – Resend email service.
- `CORS_ORIGIN` – Allowed origin in production (e.g. `https://frontend.example.com`).
- `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` – optional pgAdmin credentials.
- Any other `*_SECRET` or third‑party keys required by your infrastructure.

---

## 🐳 Docker
Two Compose files are provided:
- **`docker-compose.yml`** – production‑like stack (app, PostgreSQL, optional pgAdmin). Use it for local development or staging.
- **`docker-compose.test.yml`** – spin‑up a dedicated test database for the E2E suite.

**Build the image**
```bash
npm run docker:build   # creates arthuriarley/ark-shop-back:latest
```
**Run locally**
```bash
npm run docker:up      # starts containers in detached mode
npm run docker:logs    # tail the app logs
```
**Stop & clean**
```bash
npm run docker:clean   # stops containers, removes volumes & images
```

---

## 🤖 CI/CD (GitHub Actions)
- **`ci.yml`** – triggers on PRs and pushes to `dev`/`main`; runs lint, unit & E2E tests, builds the Docker image, and scans with **Trivy**.
- **`release.yml`** – semantic‑release pipeline that generates a changelog, creates a Git tag, and pushes the Docker image to Docker Hub (requires `DOCKER_HUB_TOKEN` secret).
- **`deploy.yml`** – deploys to staging automatically on `dev` and to production on manual trigger or a release tag.

All secrets (JWT keys, DB credentials, Docker Hub token, etc.) must be stored as **GitHub Secrets** and referenced in the workflow files.

---

## 👥 Contributing
1. Fork the repository.
2. Create a feature/bug‑fix branch (`git checkout -b feat/awesome-feature`).
3. Follow the code style: run `npm run lint && npm run format` before committing.
4. Push your branch and open a Pull Request. CI will run automatically.
5. Ensure the PR passes all checks and includes relevant tests.

---

## 📄 License
This project is proprietary to **Ark Shop**. See the `LICENSE` file for details.

---

*Generated and maintained by the Ark Shop backend team.*