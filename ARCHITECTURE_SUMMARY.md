# 🏗️ D'Ark Games Store - Architecture Summary

## Vision

Build a **highly scalable digital marketplace** for game keys with:
- Instant key delivery
- Secure payment processing
- Fraud prevention
- Multi-provider payment support
- Admin dashboard for management

---

## Current State (Phase 1 Complete ✅)

### What's Built

#### 1. Database Layer (Prisma ORM)
Complete schema with 11 models:
- **User & Auth**: User, RefreshToken
- **Financial**: Wallet, WalletTransaction, Payment
- **Commerce**: Product, Category, Order, OrderItem, Key
- **Security**: FraudLog
- **Communication**: Notification
- **Marketplace**: Seller

#### 2. Core Modules

**Products Module** (`/api/products`)
- CRUD operations with pagination
- Category support
- Soft delete (isActive flag)
- Admin-only management

**Keys Module** (`/api/keys`)
- AES-256 encryption for sensitive data
- Status tracking: AVAILABLE → RESERVED → DELIVERED
- Batch import capability
- Demo key generation for testing

**Orders Module** (`/api/orders`)
- Transaction-based creation
- Status machine with validation
- User order history
- Admin oversight

**Payments Module** (`/api/payments`)
- Provider abstraction (strategy pattern)
- PIX payment support
- Webhook handling
- Refund capability

### Architecture Patterns Used

1. **Repository Pattern**: Database logic separated from business logic
2. **Service Layer**: Business rules and orchestration
3. **Controller Layer**: HTTP handling, validation, auth
4. **Provider Pattern**: External service abstraction
5. **Transaction Management**: Critical operations wrapped in transactions

---

## Module Structure

Each module follows this structure:

```
modules/
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts  → HTTP endpoints
│   ├── products.service.ts     → Business logic
│   ├── products.repository.ts  → Database access
│   └── dto/
│       ├── create-product.dto.ts
│       └── update-product.dto.ts
```

---

## Security Features

### Implemented ✅
- Password hashing (bcrypt)
- JWT authentication (access + refresh tokens)
- Role-based access control (USER, ADMIN, SUPERADMIN)
- Key encryption (AES-256)
- Input validation (class-validator)
- CORS configuration
- Helmet security headers

### TODO 🚧
- Rate limiting
- 2FA support
- Audit logging
- IP reputation checks

---

## Data Flow Examples

### 1. User Purchases a Game Key

```
1. User creates order
   ↓
2. System validates product availability
   ↓
3. Payment created (PIX generated)
   ↓
4. User pays via PIX
   ↓
5. Webhook confirms payment
   ↓
6. Order status → PAID
   ↓
7. Key reserved for order
   ↓
8. Key delivered (decrypted)
   ↓
9. Key status → DELIVERED
   ↓
10. Email sent with key
```

### 2. Admin Imports Keys

```
1. Admin uploads CSV with keys
   ↓
2. System validates format
   ↓
3. Each key encrypted (AES-256)
   ↓
4. Keys stored in database
   ↓
5. Count returned (imported/failed)
```

---

## API Endpoints Summary

| Module | Endpoints | Auth Required | Admin Only |
|--------|-----------|---------------|------------|
| Auth | POST /register, /login, /refresh, /logout | No | No |
| Products | GET, POST, PATCH, DELETE /products | No* | Yes (write ops) |
| Keys | GET, POST, DELETE /keys | No* | Yes |
| Orders | GET, POST /orders | Yes | Partial |
| Payments | GET, POST /payments | Yes* | Partial |

*Public read, admin write

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Framework | NestJS 11 |
| Language | TypeScript 5.9 |
| Database | PostgreSQL 15 |
| ORM | Prisma 7.7 |
| Cache/Queues | Redis (planned) |
| Auth | JWT (passport-jwt) |
| Validation | class-validator |
| Docs | Swagger/OpenAPI |
| Encryption | crypto-js (AES-256) |

---

## Next Steps

### Immediate (This Week)
1. ✅ Apply Prisma migration to database
2. ✅ Test all endpoints with Swagger
3. 🚧 Add authorization checks (user can only access their own data)
4. 🚧 Create seed script for demo data

### Short Term (Next 2 Weeks)
1. Implement Antifraud module
2. Implement Notifications module (email, Discord)
3. Set up BullMQ queues
4. Add wallet system

### Long Term (Next Month)
1. Admin dashboard (React/Next.js)
2. Seller portal
3. Analytics dashboard
4. Performance optimization

---

## File Structure

```
ark-shop/
├── src/
│   ├── modules/           ← Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── products/      ✅
│   │   ├── keys/          ✅
│   │   ├── orders/        ✅
│   │   ├── payments/      ✅
│   │   ├── antifraud/     🚧
│   │   ├── notifications/ 🚧
│   │   └── admin/         🚧
│   ├── common/            ← Shared utilities
│   ├── prisma/            ← Database layer
│   ├── app.module.ts      ← Main module
│   └── main.ts            ← Entry point
├── prisma/
│   ├── schema.prisma      ← Database schema
│   └── migrations/        ← DB migrations
├── docs/                  ← Documentation
├── test/                  ← Tests
└── docker-compose.yml     ← Docker config
```

---

## Testing Strategy

### Unit Tests
- Service methods
- Repository queries
- Provider integrations

### E2E Tests
- Auth flow
- Product CRUD
- Order creation → payment → delivery
- Webhook handling

### Performance Tests
- Bulk key import
- Concurrent order creation
- Payment webhook throughput

---

## Deployment Architecture

```\nClient (Browser/Mobile)\n    ↓\nLoad Balancer\n    ↓\nAPI Instances (NestJS)\n    ↓\nPostgreSQL (Primary DB)\nRedis (Cache + Queues)\n    ↓\nExternal Services:\n- Payment Providers (Mercado Pago, Stripe)\n- Email Service (SendGrid)\n- Discord/Telegram\n```\n\n---

## Monitoring & Observability

### TODO
- Logging: Pino\n- Error Tracking: Sentry\n- Metrics: Prometheus + Grafana\n- Health Checks: `/health`, `/ready`\n- Distributed Tracing: OpenTelemetry\n\n---

## Team Guidelines

### Commit Convention
Use Conventional Commits:
```
feat(products): add category filtering\nfix(keys): resolve encryption issue\nrefactor(orders): improve transaction handling\n```\n\n### Code Style
- ESLint + Prettier (auto-fixed on commit)\n- TypeScript strict mode\n- No `any` type (use `unknown` or proper types)\n\n### Database Changes
1. Update `schema.prisma`\n2. Run `npm run prisma:generate`\n3. Run `npm run prisma:migrate`\n4. Test migration on clean DB\n\n---

## Success Metrics

- **Availability**: 99.9% uptime\n- **Latency**: < 200ms p95\n- **Throughput**: 1000 req/s\n- **Recovery**: < 5 min RTO\n\n---

## Contact & Resources

- **Project Plan**: `project-plan.md`\n- **Implementation Progress**: `IMPLEMENTATION_PROGRESS.md`\n- **Roadmap**: `IMPLEMENTATION_ROADMAP.md`\n- **API Docs**: `/api/docs` (when running)\n- **Prisma Schema**: `prisma/schema.prisma`\n\n---

*Built with ❤️ for D'Ark Games Store*  
*Last Updated: May 2026*
