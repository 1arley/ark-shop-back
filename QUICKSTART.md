# D'Ark Games Store - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Prerequisites
- Node.js 22+ (check: `node -v`)
- Docker Desktop (for database)
- Git

### 2. Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start database (Docker)
docker compose up -d postgres

# Run migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Start dev server
npm run start:dev
```

### 3. Access Swagger Docs
Open: http://localhost:3000/api/docs

---

## 📁 Project Structure

```
src/
├── modules/           # Feature modules (Products, Keys, Orders, Payments)
├── auth/              # Authentication module
├── user/              # User management
├── prisma/            # Database layer
├── common/            # Shared utilities
└── main.ts            # Entry point
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests (requires test DB)
npm run test:e2e

# All tests
npm run test:all
```

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run start:debug` | Dev server with debug mode |
| `npm run build` | Build for production |
| `npm run lint` | Lint code |
| `npm run lint:fix` | Fix lint issues |
| `npm run format` | Format code |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |
| `npm run docker:rebuild` | Full rebuild (no cache) |

---

## 🔑 Key Concepts

### Modules
Each module is self-contained with:
- Controller (HTTP endpoints)
- Service (business logic)
- Repository (database access)
- DTOs (validation)

Example: `modules/products/`

### Repository Pattern
```typescript
// Repository handles DB queries
const product = await this.productsRepository.findById(id);

// Service handles business logic
const product = await this.productsService.findOne(id);
```

### Transactions
Critical operations use Prisma transactions:
```typescript
await this.prisma.$transaction(async (tx) => {
  // All operations succeed or fail together
})
```

---

## 🔐 Authentication

All protected endpoints require JWT token:

```bash
# 1. Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123"
}

# 2. Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# 3. Use token in Authorization header
Authorization: Bearer <JWT_TOKEN>
```

---

## 📊 Database Models

### Core Models
- **User**: Customer accounts
- **Product**: Game catalog
- **Key**: Digital keys (encrypted)
- **Order**: Purchase orders
- **Payment**: Payment transactions
- **Wallet**: User balance

### Admin Models
- **FraudLog**: Fraud analysis
- **Notification**: System notifications
- **Seller**: Marketplace sellers

---

## 🛠️ Common Tasks

### Add New Product (Admin)
```bash
POST /api/products
Authorization: Bearer <ADMIN_TOKEN>
{
  "name": "Game Name",
  "description": "Description",
  "price": 29.99,
  "stock": 100
}
```

### Import Keys (Admin)
```bash
POST /api/keys/import
{
  "productId": "uuid",
  "keys": ["KEY1", "KEY2", "KEY3"]
}
```

### Create Order
```bash
POST /api/orders
{
  "items": [
    { "productId": "uuid", "quantity": 1 }
  ]
}
```

### Generate PIX Payment
```bash
POST /api/payments/:orderId
{
  "amount": 29.99,
  "method": "PIX"
}
```

---

## 🐛 Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npm run prisma:generate
```

### "Database connection error"
```bash
docker compose up -d postgres
npm run prisma:migrate
```

### "Port 3000 already in use"
```bash
# Change PORT in .env
PORT=3001
```

---

## 📚 Documentation

- **Architecture**: `ARCHITECTURE_SUMMARY.md`
- **Progress**: `IMPLEMENTATION_PROGRESS.md`
- **Roadmap**: `IMPLEMENTATION_ROADMAP.md`
- **Project Plan**: `project-plan.md`
- **API Docs**: http://localhost:3000/api/docs

---

## 🆘 Getting Help

1. Check documentation in `docs/` folder
2. Review Prisma schema: `prisma/schema.prisma`
3. Check Swagger docs when running
4. Review test files for examples

---

## ✅ Checklist Before PR

- [ ] Code compiles (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm run test`)
- [ ] Prisma client generated
- [ ] Migration files created
- [ ] Swagger docs updated
- [ ] Environment variables documented

---

*Happy coding! 🎮*
