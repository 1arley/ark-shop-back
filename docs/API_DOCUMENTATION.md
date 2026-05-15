# D'Ark Games Store - Complete API Documentation

## Overview

**D'Ark Games Store** is a production-ready e-commerce platform for digital game keys built with NestJS, Prisma ORM, and PostgreSQL.

### Key Features

- ✅ **Product Catalog** - Manage products with categories
- ✅ **Shopping Cart** - Persistent cart with Prisma
- ✅ **Order Processing** - Transaction-safe order creation
- ✅ **Payment Integration** - Asaas (PIX) with webhooks
- ✅ **Key Delivery** - Encrypted key storage (AES-256)
- ✅ **Admin Dashboard** - Statistics, bulk operations
- ✅ **Fraud Detection** - Risk scoring and analysis
- ✅ **Authorization** - JWT with role-based access

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start database
docker compose up -d

# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Start development server
npm run start:dev
```

Access Swagger docs at: http://localhost:3000/api/docs

## Authentication

All protected endpoints require JWT authentication.

### Register

```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

### Login

```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { ... }
}
```

### Use Token

Include in Authorization header:

```
Authorization: Bearer <access_token>
```

## API Endpoints

### Products

#### List Products

```bash
GET /api/products?page=1&limit=10&search=game&isActive=true
```

#### Get Product

```bash
GET /api/products/:id
```

#### Create Product (Admin)

```bash
POST /api/products
Authorization: Bearer <token>
{
  "name": "Cyberpunk 2077",
  "price": 59.99,
  "description": "Open world RPG",
  "stock": 100,
  "categoryId": "uuid"
}
```

#### Update Product (Admin)

```bash
PATCH /api/products/:id
{
  "name": "Updated Name",
  "price": 49.99
}
```

#### Delete Product (Admin)

```bash
DELETE /api/products/:id
```

### Shopping Cart

#### Get Cart

```bash
GET /api/cart
```

#### Add to Cart

```bash
POST /api/cart/items
{
  "productId": "uuid",
  "quantity": 2
}
```

#### Update Cart Item

```bash
PATCH /api/cart/items/:productId
{
  "quantity": 3
}
```

#### Remove from Cart

```bash
DELETE /api/cart/items/:productId
```

#### Clear Cart

```bash
DELETE /api/cart
```

### Orders

#### Create Order

```bash
POST /api/orders
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 1
    }
  ]
}
```

#### Get User Orders

```bash
GET /api/orders?page=1&limit=10
```

#### Get Order Details

```bash
GET /api/orders/:id
```

#### Cancel Order

```bash
POST /api/orders/:id/cancel
```

#### Get Recent Orders (Admin)

```bash
GET /api/orders/recent?limit=10
```

#### Update Order Status (Admin)

```bash
PATCH /api/orders/:id/status
{
  "status": "PAID" // PENDING, AWAITING_PAYMENT, PAID, PROCESSING, DELIVERED, CANCELLED, REFUNDED
}
```

#### Deliver Order (Admin)

```bash
POST /api/orders/:id/deliver
```

#### Download Keys

```bash
GET /api/orders/:id/download
```

### Payments

#### Create Payment

```bash
POST /api/payments/:orderId
{
  "amount": 59.99,
  "provider": "ASAAS",
  "method": "PIX"
}
```

#### Get Payment

```bash
GET /api/payments/:id
```

#### Get Payment by Order

```bash
GET /api/payments/order/:orderId
```

#### Refund Payment (Admin)

```bash
POST /api/payments/:id/refund
{
  "amount": 59.99 // Optional, for partial refunds
}
```

#### Webhook Handler

```bash
POST /api/payments/webhook/asaas
X-Signature: <hmac-sha256-signature>
{
  "action": "payment.updated",
  "data": { "id": "payment_id" }
}
```

### Keys (Admin Only)

#### Import Keys

```bash
POST /api/keys/import
{
  "productId": "uuid",
  "keys": ["KEY1-ABCD-1234", "KEY2-EFGH-5678"]
}
```

#### Get Product Keys

```bash
GET /api/keys/product/:productId?page=1&limit=50
```

#### Get Key Statistics

```bash
GET /api/keys/stats/:productId
```

#### Generate Demo Keys

```bash
POST /api/keys/generate-demo
{
  "productId": "uuid",
  "quantity": 10
}
```

### Categories

#### List Categories

```bash
GET /api/categories
```

#### Get Root Categories

```bash
GET /api/categories/root
```

#### Create Category (Admin)

```bash
POST /api/categories
{
  "name": "Action",
  "description": "Action games",
  "parentId": "uuid" // Optional, for subcategories
}
```

### Admin Dashboard

#### Get Dashboard Stats

```bash
GET /api/admin/dashboard
```

Response:

```json
{
  "revenue": {
    "total": 10000,
    "today": 500,
    "thisWeek": 2000,
    "thisMonth": 8000
  },
  "orders": {
    "total": 150,
    "pending": 10,
    "processing": 5,
    "completed": 130,
    "cancelled": 5
  },
  "products": {
    "total": 50,
    "active": 45,
    "inactive": 5,
    "lowStock": 3
  },
  "keys": {
    "total": 500,
    "available": 400,
    "reserved": 20,
    "delivered": 80
  }
}
```

#### Get All Users

```bash
GET /api/admin/users?page=1&limit=20
```

#### Get Fraud Logs

```bash
GET /api/admin/fraud-logs?page=1&limit=20
```

#### Bulk Import Keys

```bash
POST /api/admin/keys/import
{
  "productId": "uuid",
  "keysText": "KEY1\nKEY2\nKEY3",
  "isCsv": false
}
```

#### Generate Demo Data

```bash
POST /api/admin/generate-demo
{
  "productsCount": 5,
  "keysPerProduct": 10
}
```

#### Clear Demo Data (SUPERADMIN only)

```bash
POST /api/admin/clear-demo
```

### Antifraud

#### Get Fraud Logs (Admin)

```bash
GET /api/antifraud/logs?limit=100
```

## Database Schema

### Main Entities

- **User** - Customer accounts
- **Cart** - Shopping carts
- **CartItem** - Cart items
- **Product** - Product catalog
- **Category** - Hierarchical categories
- **Key** - Encrypted digital keys
- **Order** - Customer orders
- **OrderItem** - Order line items
- **Payment** - Payment transactions
- **Wallet** - User balance
- **FraudLog** - Fraud analysis logs

### Key Statuses

- `AVAILABLE` - Ready for sale
- `RESERVED` - Reserved for order
- `DELIVERED` - Delivered to customer

### Order Statuses

- `PENDING` - Order created
- `AWAITING_PAYMENT` - Waiting for payment
- `PAID` - Payment confirmed
- `PROCESSING` - Processing order
- `DELIVERED` - Keys delivered
- `CANCELLED` - Order cancelled
- `REFUNDED` - Payment refunded

## Security

### Encryption

- Keys encrypted with AES-256
- Passwords hashed with bcrypt
- JWT tokens for authentication

### Authorization

- Role-based access control (USER, ADMIN, SUPERADMIN)
- Users can only access their own data
- Admin endpoints require ADMIN or SUPERADMIN role

### Webhooks

- HMAC-SHA256 signature verification
- Automatic retry with exponential backoff
- Idempotent processing

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# All tests
npm run test:all

# Test with coverage
npm run test:cov
```

## Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/seedabit_db

# JWT
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
KEYS_ENCRYPTION_KEY=min-32-characters-secret

# Asaas (Payment Provider - PRIMARY)
ASAAS_API_KEY=seu_api_key_aqui
ASAAS_SANDBOX=true
ASAAS_WEBHOOK_SECRET=seu_webhook_secret_aqui
ASAAS_PLATFORM_PIX_KEY=your-pix-key-here
ASAAS_PLATFORM_WALLET_ID=

# Payment
PAYMENT_DEFAULT_PROVIDER=ASAAS

# Legacy (Mercado Pago - no longer used)
# MERCADO_PAGO_ACCESS_TOKEN=your-token
# MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret
```

## Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start:prod

# Docker production
docker compose up -d --build
```

## Support

For issues or questions:

1. Check documentation: `/api/docs`
2. Review logs: `docker compose logs -f app`
3. Check health: `GET /api/health`

---

**Version:** 1.0.0  
**Last Updated:** May 2026  
**Status:** Production Ready ✅
