# Implementation Roadmap: Digital Key Store Platform

## Current State Analysis

**Existing (✅):**
- NestJS 11 with TypeScript (nodenext modules)
- Auth module with JWT (access + refresh tokens)
- User module with basic CRUD
- Prisma ORM with PostgreSQL
- Role enum: USER, ADMIN, SUPERADMIN
- Swagger docs, class-validator, bcrypt

**Gaps vs Project Plan:**
- ❌ No modular structure (modules/ directory)
- ❌ No Repository pattern separation
- ❌ Missing core modules: Products, Keys, Orders, Payments, Antifraud, Notifications
- ❌ No queue system (Redis/BullMQ)
- ❌ No encryption for sensitive data
- ❌ No transaction management patterns
- ❌ No event-driven architecture

---

## Phase 1: Foundation Restructure (Priority: HIGH)

### 1.1 Reorganize Directory Structure
```
src/
├── modules/
│   ├── auth/          # Move existing auth here
│   ├── users/         # Move existing user here
│   ├── products/      # NEW
│   ├── keys/          # NEW
│   ├── orders/        # NEW
│   ├── payments/      # NEW
│   ├── antifraud/     # NEW
│   ├── notifications/ # NEW
│   └── admin/         # NEW
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── interfaces/
│   ├── enums/
│   └── constants.ts
├── config/            # NEW - Configuration modules
├── database/          # NEW - Database utilities
├── queues/            # NEW - BullMQ queues
└── providers/         # NEW - Shared providers
```

### 1.2 Update Prisma Schema
Add tables for:
- Products (catalog)
- Keys (digital inventory with encryption)
- Orders (purchase tracking)
- OrderItems
- Payments (transaction tracking)
- Wallet/Balance
- Notifications
- Fraud logs
- Coupons
- Sellers (if marketplace)

### 1.3 Establish Common Patterns
- Base Repository class
- Base Service class
- Event emitters (for event-driven architecture)
- Transaction decorators/helpers

---

## Phase 2: Core Modules (Priority: HIGH)

### 2.1 Products Module
**Files:**
- `modules/products/products.module.ts`
- `modules/products/products.controller.ts`
- `modules/products/products.service.ts`
- `modules/products/products.repository.ts`
- `modules/products/dto/create-product.dto.ts`
- `modules/products/dto/update-product.dto.ts`
- `modules/products/entities/product.entity.ts`

**Features:**
- Product CRUD
- Categories
- Pricing
- Stock management
- SEO metadata
- Soft delete

### 2.2 Keys Module (CRITICAL - High Security)
**Files:**
- `modules/keys/keys.module.ts`
- `modules/keys/keys.service.ts`
- `modules/keys/keys.repository.ts`
- `modules/keys/keys.controller.ts` (admin only)
- `modules/keys/keysencryption.provider.ts`
- `modules/keys/dto/import-keys.dto.ts`
- `modules/keys/entities/key.entity.ts`

**Features:**
- AES-256 encryption for keys
- Key import (bulk CSV/JSON)
- Key status: AVAILABLE | RESERVED | DELIVERED | ARCHIVED
- Key reservation system
- Audit logging

**Security:**
- Never store plain text keys
- Encrypt at rest, decrypt only on delivery
- Key access logging

### 2.3 Orders Module
**Files:**
- `modules/orders/orders.module.ts`
- `modules/orders/orders.service.ts`
- `modules/orders/orders.repository.ts`
- `modules/orders/orders.controller.ts`
- `modules/orders/dto/create-order.dto.ts`
- `modules/orders/entities/order.entity.ts`
- `modules/orders/entities/order-item.entity.ts`

**Features:**
- Cart → Order conversion
- Order status machine: PENDING → AWAITING_PAYMENT → PAID → PROCESSING → DELIVERED
- Order items tracking
- Refund tracking
- Purchase history

**Transaction Flow:**
```typescript
async createOrder(dto) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Validate stock
    // 2. Reserve keys
    // 3. Create order
    // 4. Create order items
    // 5. Emit event: order.created
  })
}
```

---

## Phase 3: Payment & Fraud (Priority: HIGH)

### 3.1 Payments Module
**Files:**
- `modules/payments/payments.module.ts`
- `modules/payments/payments.service.ts`
- `modules/payments/payments.repository.ts`
- `modules/payments/payments.controller.ts`
- `modules/payments/providers/` (strategy pattern)
  - `payment.provider.ts` (interface)
  - `mercado-pago.provider.ts`
  - `stripe.provider.ts`
  - `asaas.provider.ts`
- `modules/payments/dto/process-payment.dto.ts`
- `modules/payments/entities/payment.entity.ts`

**Features:**
- Payment provider abstraction (strategy pattern)
- PIX generation
- Card payments
- Webhook handling
- Payment reconciliation
- Refunds

### 3.2 Antifraud Module
**Files:**
- `modules/antifraud/antifraud.module.ts`
- `modules/antifraud/antifraud.service.ts`
- `modules/antifraud/antifraud.repository.ts`
- `modules/antifraud/pipelines/`
  - `ip-reputation.pipeline.ts`
  - `velocity-check.pipeline.ts`
  - `device-fingerprint.pipeline.ts`
  - `blacklist.pipeline.ts`
- `modules/antifraud/dto/risk-analysis.dto.ts`
- `modules/antifraud/entities/fraud-log.entity.ts`

**Features:**
- IP reputation check
- Device fingerprinting
- Velocity checks (purchases per hour/day)
- Blacklist validation
- Risk scoring (0-100)
- Manual review queue

**Pipeline:**
```
Purchase Attempt
  ↓
Risk Analysis Pipeline
  ↓
Score: 0-30  → Approve
Score: 31-70 → Manual Review
Score: 71+   → Reject
```

---

## Phase 4: Notifications & Queues (Priority: MEDIUM)

### 4.1 Queue System Setup
**Install:** `bullmq`, `ioredis`

**Files:**
- `queues/queues.module.ts`
- `queues/processors/`
  - `email.processor.ts`
  - `key-delivery.processor.ts`
  - `fraud-analysis.processor.ts`
  - `webhook-retry.processor.ts`
- `queues/events/`
  - `events.service.ts`
  - `events.constants.ts`

**Events:**
- `payment.approved` → trigger key delivery
- `order.created` → trigger fraud analysis
- `key.delivered` → send email notification
- `payment.failed` → retry logic

### 4.2 Notifications Module
**Files:**
- `modules/notifications/notifications.module.ts`
- `modules/notifications/notifications.service.ts`
- `modules/notifications/providers/`
  - `email.provider.ts`
  - `discord.provider.ts`
  - `telegram.provider.ts`
- `modules/notifications/templates/`

**Features:**
- Email notifications (key delivery, payment confirmation)
- Discord webhooks
- Telegram notifications
- Template system

---

## Phase 5: Advanced Features (Priority: LOW)

### 5.1 Admin Module
- Dashboard metrics
- User management
- Product management
- Order management
- Key import/export
- Fraud review queue

### 5.2 Sellers Module (Marketplace)
- Seller onboarding
- Commission calculation
- Revenue tracking
- Withdrawal requests

### 5.3 Wallet System
- User balance
- Cashback
- Wallet transactions
- Deposit/withdrawal

---

## Database Migration Strategy

### Step 1: Add new tables to `prisma/schema.prisma`
```prisma
model Product {
  id          String   @id @default(uuid())
  name        String
  description String?
  price       Decimal
  stock       Int
  categoryId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  keys        Key[]
  orderItems  OrderItem[]
}

model Key {
  id         String   @id @default(uuid())
  productId  String
  keyData    String   -- ENCRYPTED
  status     KeyStatus @default(AVAILABLE)
  deliveredAt DateTime?
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  orderId    String?
  order      OrderItem? @relation(fields: [orderId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum KeyStatus {
  AVAILABLE
  RESERVED
  DELIVERED
  ARCHIVED
}

model Order {
  id            String      @id @default(uuid())
  userId        String
  status        OrderStatus @default(PENDING)
  total         Decimal
  items         OrderItem[]
  payment       Payment?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  productId String
  keyId     String?
  quantity  Int
  price     Decimal
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])
  key       Key?    @relation(fields: [keyId], references: [id])
}

enum OrderStatus {
  PENDING
  AWAITING_PAYMENT
  PAID
  PROCESSING
  DELIVERED
  CANCELLED
  REFUNDED
}

model Payment {
  id              String        @id @default(uuid())
  orderId         String        @unique
  provider        PaymentProvider
  providerTxId    String?
  amount          Decimal
  status          PaymentStatus
  method          PaymentMethod
  webhookData     Json?
  order           Order         @relation(fields: [orderId], references: [id])
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum PaymentStatus {
  PENDING
  APPROVED
  REJECTED
  REFUNDED
}

enum PaymentProvider {
  MERCADO_PAGO
  STRIPE
  ASAAS
}

enum PaymentMethod {
  PIX
  CREDIT_CARD
  DEBIT_CARD
  BOLETO
}
```

---

## Testing Strategy

### Unit Tests
- Services (business logic)
- Repositories (query logic)
- Providers (external integrations)

### E2E Tests
- Auth flow
- Product CRUD
- Order creation → payment → delivery
- Fraud detection
- Webhook handling

### Test Data
- Seed scripts for products, keys
- Mock payment providers
- Test users with different roles

---

## Security Checklist

- [ ] Keys encrypted with AES-256
- [ ] Passwords hashed with bcrypt/argon2
- [ ] JWT with short expiration (15min access, 7d refresh)
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured
- [ ] Helmet security headers
- [ ] Input validation (class-validator)
- [ ] SQL injection prevention (Prisma)
- [ ] Audit logging for admin actions
- [ ] Environment variables for secrets

---

## Deployment Checklist

- [ ] Docker multi-stage build
- [ ] Health check endpoint
- [ ] Graceful shutdown
- [ ] Database migrations on deploy
- [ ] Redis for queues
- [ ] Environment-specific configs
- [ ] Logging (Pino)
- [ ] Error tracking (Sentry)
- [ ] Metrics (Prometheus/Grafana)

---

## Next Steps

1. **Immediate:** Restructure to modular architecture (Phase 1)
2. **Week 1-2:** Implement Products, Keys modules (Phase 2)
3. **Week 3-4:** Implement Orders, Payments, Antifraud (Phase 3)
4. **Week 5:** Queue system and Notifications (Phase 4)
5. **Week 6+:** Admin panel, Sellers, Wallet (Phase 5)

---

## References

- Project Plan: `project-plan.md`
- Code Conventions: `docs/code-conventions.md`
- Authentication: `docs/authentication.md`
- Prisma Setup: `docs/prisma.md`
