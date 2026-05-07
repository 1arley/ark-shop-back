# Backend Architecture — Digital Key Store Platform

---

# Architecture

The backend is divided into isolated modules to improve:

- Scalability
- Maintainability
- Security
- Reusability
- Fault isolation

```txt
apps/api
├── src
│   ├── modules
│   │   ├── auth
│   │   ├── users
│   │   ├── products
│   │   ├── keys
│   │   ├── orders
│   │   ├── payments
│   │   ├── antifraud
│   │   ├── notifications
│   │   ├── sellers
│   │   └── admin
│   │
│   ├── common
│   │   ├── guards
│   │   ├── interceptors
│   │   ├── filters
│   │   ├── decorators
│   │   ├── exceptions
│   │   └── utils
│   │
│   ├── config
│   ├── database
│   ├── queues
│   ├── providers
│   └── main.ts
```

---

# Architectural Pattern

The backend follows a layered modular architecture:

```txt
Controller Layer
        ↓
Service Layer
        ↓
Repository Layer
        ↓
Database
```

## Responsibilities

### Controller Layer

Responsible for:

- HTTP handling
- Validation
- Authentication guards
- Request parsing
- Response formatting

Controllers should never contain business logic.

Example:

```ts
@Post()
createOrder(@Body() dto: CreateOrderDto) {
  return this.ordersService.create(dto)
}
```

---

### Service Layer

Responsible for:

- Business logic
- Validation rules
- Transaction orchestration
- External integrations
- Security checks

This is the core of the system.

Example:

```ts
async create(dto: CreateOrderDto) {
  await this.antifraud.validate(dto)

  const payment = await this.paymentService.createPix(dto)

  return payment
}
```

---

### Repository Layer

Responsible for:

- Database communication
- Query abstraction
- Persistence

Repositories isolate Prisma/database implementation details from services.

Example:

```ts
async findAvailableKey(productId: string) {
  return this.prisma.key.findFirst({
    where: {
      productId,
      status: "AVAILABLE"
    }
  })
}
```

---

# Core Modules

---

# 1. Auth Module

File: `modules/auth`

Responsible for authentication and authorization.

## Features

- JWT authentication
- Refresh tokens
- Session management
- 2FA support
- Password recovery
- Role-based access control

## Structure

```txt
auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.repository.ts
├── dto/
├── guards/
├── strategies/
└── interfaces/
```

---

# 2. Users Module

File: `modules/users`

Responsible for customer accounts and balances.

## Responsibilities

- User profile
- Wallet balance
- Cashback
- Permissions
- User settings

---

# 3. Products Module

File: `modules/products`

Responsible for catalog management.

## Responsibilities

- Product CRUD
- Categories
- SEO metadata
- Pricing
- Promotions
- Stock visibility

## Product Flow

```txt
Admin creates product
        ↓
Product stored in DB
        ↓
Product indexed for search
        ↓
Displayed in storefront
```

---

# 4. Keys Module

File: `modules/keys`

Critical module responsible for digital inventory.

## Responsibilities

- Key import
- Key encryption
- Inventory tracking
- Key reservation
- Delivery pipeline

## Key Lifecycle

```txt
Imported
   ↓
Available
   ↓
Reserved
   ↓
Delivered
   ↓
Archived
```

## Why isolated?

The key system handles highly sensitive digital assets and requires stricter transactional guarantees.

---

# 5. Orders Module

File: `modules/orders`

Responsible for purchase orchestration.

## Responsibilities

- Cart conversion
- Order creation
- Status management
- Refund tracking
- Purchase history

## Order Lifecycle

```txt
Pending
 ↓
Awaiting Payment
 ↓
Paid
 ↓
Processing
 ↓
Delivered
```

---

# 6. Payments Module

File: `modules/payments`

Responsible for gateway integration.

## Providers

- Mercado Pago
- Stripe
- Pagar.me
- Asaas

## Responsibilities

- PIX generation
- Card payments
- Webhook validation
- Refunds
- Payment reconciliation

## Why webhooks?

Payment providers are the source of truth.
Orders should only be approved after official webhook confirmation.

---

# 7. Antifraud Module

File: `modules/antifraud`

Responsible for risk analysis before delivery.

## Responsibilities

- VPN detection
- IP reputation
- Device fingerprinting
- Velocity checks
- Blacklists
- Risk scoring

## Validation Pipeline

```txt
Purchase Attempt
        ↓
Risk Analysis
        ↓
Approve / Reject / Manual Review
```

---

# 8. Notifications Module

File: `modules/notifications`

Centralized communication system.

## Channels

- Email
- Discord
- Telegram
- Webhooks

## Responsibilities

- Key delivery emails
- Payment confirmation
- Fraud alerts
- Refund notifications

---

# 9. Sellers Module

File: `modules/sellers`

Optional marketplace support.

## Responsibilities

- Seller onboarding
- Commission calculation
- Revenue tracking
- Withdrawal requests

---

# Database Architecture

---

# Database Stack

```txt
PostgreSQL
        +
Prisma ORM
```

Why PostgreSQL:

- Strong transactional guarantees
- Reliable indexing
- JSON support
- High scalability
- Excellent concurrency

---

# Database Structure

## Main Entities

```txt
users
products
keys
orders
payments
wallet_transactions
coupons
sellers
notifications
fraud_logs
```

---

# Example Relations

```txt
User
 └── Orders
       └── OrderItems
              └── Product
                     └── Keys
```

---

# Queue System

File: `queues/`

The backend uses asynchronous queues for heavy operations.

## Stack

```txt
Redis + BullMQ
```

## Queue Jobs

- Key delivery
- Email sending
- Fraud analysis
- Webhook retries
- Stock synchronization

Why queues:

Expensive operations should not block HTTP requests.

---

# Transaction Management

Critical operations use database transactions.

## Example

```txt
Payment Approved
        ↓
Reserve Key
        ↓
Mark Order Paid
        ↓
Generate Delivery
        ↓
Commit
```

If any step fails:

```txt
Rollback Transaction
```

Why:

Prevents duplicated key delivery and inconsistent orders.

---

# Security Architecture

---

# Authentication

```txt
JWT Access Token
        +
Refresh Token
```

## Protection Layers

- Rate limiting
- Helmet
- CORS
- CSRF protection
- WAF
- Request validation
- IP throttling

---

# Sensitive Data Protection

## Keys

Digital keys should never be stored as plain text.

Recommended:

```txt
AES-256 Encryption
```

## Passwords

```txt
argon2
```

---

# Infrastructure

---

# Recommended Stack

## API

```txt
NestJS
Node.js
TypeScript
```

## Database

```txt
PostgreSQL
Prisma ORM
```

## Cache & Queues

```txt
Redis
BullMQ
```

## Deployment

```txt
Docker
NGINX
Cloudflare
```

---

# Scalability Strategy

## Horizontal Scaling

The API should remain stateless.

```txt
Client
  ↓
Load Balancer
  ↓
API Instances
  ↓
Shared Redis + PostgreSQL
```

---

# Caching Strategy

Use Redis for:

- Product cache
- Session cache
- Rate limits
- Temporary checkout reservations

---

# Event-Driven Architecture

Critical actions emit events.

## Example

```txt
payment.approved
        ↓
key.deliver
        ↓
email.send
        ↓
analytics.track
```

Why:

Loose coupling between modules improves scalability and maintainability.

---

# Error Handling

## Error Types

| Type | Example |
|---|---|
| Validation Error | Invalid DTO |
| Business Error | Out of stock |
| Fraud Error | VPN detected |
| Infrastructure Error | Database unavailable |
| External Error | Gateway timeout |

---

# Logging & Monitoring

## Recommended Stack

```txt
Pino
Grafana
Prometheus
Sentry
```

## Log Categories

- Payments
- Deliveries
- Fraud attempts
- Authentication
- Admin actions

---

# Final Goal

Build a highly scalable backend capable of:

- Handling digital inventory safely
- Delivering keys instantly
- Preventing fraud
- Scaling horizontally
- Supporting marketplaces
- Processing thousands of concurrent purchases

The backend should prioritize:

- Transaction safety
- Fault tolerance
- Security
- Modular scalability
- Operational automation