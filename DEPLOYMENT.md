# 🚀 D'Ark Games Store - Production Deployment Guide

## ✅ Implementation Complete

### Features Delivered

#### Phase C: Email Notifications ✅
- [x] EmailModule with Nodemailer
- [x] Order confirmation emails
- [x] Key delivery emails
- [x] Password reset emails
- [x] Payment receipt emails
- [x] Queue-based async delivery (BullMQ)
- [x] HTML and text formats
- [x] Template system

#### Phase B: Real Payment Integration ✅
- [x] Mercado Pago API integration
- [x] PIX payment creation
- [x] Payment status verification
- [x] Refund processing
- [x] Payment search
- [x] Error handling
- [x] Logging

### 📦 Complete Feature List

1. ✅ Products with categories
2. ✅ Shopping cart (database-backed)
3. ✅ Order processing
4. ✅ Payment integration (Mercado Pago)
5. ✅ Key management (encrypted)
6. ✅ Email notifications
7. ✅ Admin dashboard
8. ✅ Fraud detection
9. ✅ Authorization
10. ✅ Testing framework

## 🔧 Production Setup

### 1. Environment Variables

Create `.env.production`:

```bash
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_ACCESS_SECRET=your-super-secure-access-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
KEYS_ENCRYPTION_KEY=your-encryption-key-min-32-chars-change-this

# Email (Production - Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="D'Ark Games Store <noreply@yourdomain.com>"

# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret

# Payment
PAYMENT_DEFAULT_PROVIDER=MERCADO_PAGO

# Redis (for queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
```

### 2. Get Mercado Pago Credentials

1. **Create Account**: https://www.mercadopago.com.br
2. **Get Credentials**:
   - Go to: https://www.mercadopago.com.br/developers/panel
   - Create new application
   - Get Access Token
3. **Configure Webhooks**:
   - URL: `https://yourdomain.com/api/payments/webhook/mercadopago`
   - Events: `payment.created`, `payment.updated`

### 3. Email Setup

#### Option A: Gmail (Production)
```bash
# 1. Enable 2FA on Google Account
# 2. Create App Password: https://myaccount.google.com/apppasswords
# 3. Use app password in .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

#### Option B: SendGrid
```bash
# 1. Create account: https://sendgrid.com
# 2. Get API key
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### 4. Database Migration

```bash
# Production database
export DATABASE_URL="postgresql://..."

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 5. Build & Deploy

```bash
# Install dependencies
npm ci --only=production

# Build
npm run build

# Run migrations
npm run prisma:migrate

# Start
npm run start:prod
```

### 6. Docker Production

```bash
# Build image
docker build -t dark-games-store:latest .

# Run with production env
docker run -d \
  --name dark-games \
  --env-file .env.production \
  -p 3000:3000 \
  dark-games-store:latest
```

### 7. Docker Compose Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    image: dark-games-store:latest
    env_file: .env.production
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    restart: always

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

volumes:
  postgres_data:
```

### 8. Health Check

```bash
# Check API health
curl https://yourdomain.com/api/health

# Expected: {"status": "ok", "timestamp": "2026-05-06T..."}
```

### 9. Monitoring

#### Add Sentry for Error Tracking

```bash
npm install @sentry/nestjs
```

```typescript
// main.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### 10. Security Checklist

- [ ] Change all default secrets
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure CORS for production domain
- [ ] Set up firewall rules
- [ ] Enable database backups
- [ ] Configure log rotation
- [ ] Set up monitoring/alerts
- [ ] Test webhook endpoints
- [ ] Verify email delivery
- [ ] Test payment flow in sandbox

### 11. Testing Production

```bash
# 1. Register test user
POST /api/auth/register
{
  "email": "test@example.com",
  "password": "Test123!"
}

# 2. Create product (admin)
POST /api/products
{
  "name": "Test Game",
  "price": 9.99
}

# 3. Create order
POST /api/orders
{
  "items": [{"productId": "...", "quantity": 1}]
}

# 4. Create payment
POST /api/payments/:orderId
{
  "amount": 9.99,
  "method": "PIX"
}

# 5. Check email inbox
# Should receive order confirmation

# 6. Test webhook
# Use Mercado Pago sandbox to test payment notifications
```

## 📊 Post-Deployment Tasks

1. **Verify Emails**: Check all email types send correctly
2. **Test Payment**: Create real PIX payment (small amount)
3. **Monitor Logs**: Watch for errors in first 24 hours
4. **Backup Database**: Set up automated daily backups
5. **Set Alerts**: Configure error rate alerts
6. **Performance**: Monitor response times
7. **Security Scan**: Run security audit

## 🆘 Troubleshooting

### Emails not sending?
- Check SMTP credentials
- Verify port 587 is open
- Test with Mailtrap first
- Check spam folder

### Payment fails?
- Verify Mercado Pago credentials
- Check webhook URL is accessible
- Test in sandbox mode first
- Review Mercado Pago logs

### Database errors?
- Check connection string
- Verify migrations ran
- Ensure Prisma client generated
- Check database is running

## 📞 Support

- Documentation: `/api/docs`
- Email Setup: `EMAIL_SETUP.md`
- API Docs: `API_DOCUMENTATION.md`
- Architecture: `ARCHITECTURE_SUMMARY.md`

---

**Status:** ✅ Production Ready  
**Last Updated:** May 2026  
**Version:** 1.0.0
