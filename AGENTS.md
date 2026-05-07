# D'Ark Games Store - Agent Quick Reference

## 🚀 Quick Commands

```bash
npm run start:dev       # Dev server with watch
npm run lint            # Lint (eslint + prettier)
npm run test            # Unit tests
npm run test:e2e        # E2E tests (requires test DB)
npm run prisma:generate # Regenerate Prisma client
npm run prisma:migrate  # Run migrations
npm run docker:up       # Start app + postgres
npm run docker:down     # Stop containers
```

**Docker:**
```bash
docker compose up -d --build  # Build and start
docker compose logs app -f    # Follow app logs
docker compose down -v        # Stop and remove volumes
```

## 📁 Architecture

**Framework:** NestJS 11 + TypeScript  
**Database:** PostgreSQL via Prisma ORM  
**Auth:** JWT (access + refresh tokens)  
**API Docs:** Swagger at `/api/docs`

**Modules:**
- `auth/` - JWT authentication
- `user/` - User management
- `products/` - Product catalog
- `keys/` - Encrypted key storage (AES-256)
- `orders/` - Order processing
- `payments/` - Payment abstraction
- `categories/` - Product categories
- `admin/` - Dashboard & bulk operations
- `antifraud/` - Risk analysis

**Path aliases:** `@/`, `@utils/`, `@test/`

## 🔑 Key Features

### 1. Products & Keys
- Products have categories (hierarchical)
- Keys are encrypted at rest (AES-256)
- Key status: AVAILABLE → RESERVED → DELIVERED
- Bulk import via admin API

### 2. Orders & Payments
- Transaction-safe order creation
- Payment provider abstraction (Mercado Pago, Stripe, Asaas)
- PIX support
- Order status machine

### 3. Admin Dashboard
- Statistics (revenue, orders, products, keys)
- User management
- Fraud logs
- Bulk key import
- Demo data generation

### 4. Antifraud
- IP reputation checks
- Velocity checks (orders/hour)
- Device fingerprinting
- Risk scoring (0-100)
- Auto-reject high risk

## 📊 Database Models

```
User → Orders → OrderItems → Product → Keys
                ↓
            Payment
```

**Enums:** Role, KeyStatus, OrderStatus, PaymentStatus, PaymentProvider, PaymentMethod

## 🧪 Testing

```bash
npm run test          # Unit tests (no DB)
npm run test:e2e      # E2E (needs test DB)
npm run test:all      # Both
```

**Test DB:** `docker compose -f docker-compose.test.yml up -d`

## 🔐 Gotchas

- **Node 22 required** (`.nvmrc`)
- **Prisma generate** after schema changes
- **E2E tests** need `.env.test` + separate DB
- **Husky** runs on commit: lint → prettier
- **Keys encrypted** - never store plain text
- **Transactions** for critical operations

## 🛠️ Common Tasks

### Create Product (Admin)
```bash
POST /api/products
{
  "name": "Game Name",
  "price": 59.99,
  "description": "Description",
  "categoryId": "uuid" (optional)
}
```

### Import Keys (Admin)
```bash
POST /api/admin/keys/import
{
  "productId": "uuid",
  "keysText": "KEY1\nKEY2\nKEY3",
  "isCsv": false
}
```

### Generate Demo Data (Admin)
```bash
POST /api/admin/generate-demo
{
  "productsCount": 5,
  "keysPerProduct": 10
}
```

### Get Dashboard Stats (Admin)
```bash
GET /api/admin/dashboard
```

## 📚 Documentation

- `QUICKSTART.md` - Developer quick start
- `ARCHITECTURE_SUMMARY.md` - Full architecture
- `IMPLEMENTATION_PROGRESS.md` - What's done/TODO
- `project-plan.md` - Original plan
- Swagger: `/api/docs`

## 🚨 Common Issues

**"Cannot find module '@prisma/client'"**
```bash
npm run prisma:generate
```

**"Database connection error"**
```bash
docker compose up -d postgres
```

**"Migration file missing"**
```bash
# Delete incomplete migration folder
rm -rf prisma/migrations/20260506000000_*
```

## 📦 Environment Variables

```bash
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
KEYS_ENCRYPTION_KEY=min-32-chars
PAYMENT_DEFAULT_PROVIDER=MERCADO_PAGO
```

See `.env.example` for full list.

---

*Last updated: May 2026*
