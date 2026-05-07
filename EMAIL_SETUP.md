# Email Configuration Guide

## Setup

### 1. Development (Mailtrap - Recommended)

Mailtrap is perfect for testing email delivery without sending real emails.

```bash
# 1. Create account at https://mailtrap.io
# 2. Get SMTP credentials from Mailtrap dashboard
# 3. Add to .env:

SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
EMAIL_FROM="D'Ark Games Store <noreply@darkgames.com>"
```

### 2. Production Options

#### Option A: Gmail/Google Workspace
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
EMAIL_FROM="D'Ark Games Store <your-email@gmail.com>"
```

#### Option B: SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM="D'Ark Games Store <noreply@yourdomain.com>"
```

#### Option C: Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-password
EMAIL_FROM="D'Ark Games Store <noreply@yourdomain.com>"
```

## Email Templates

The system sends 4 types of emails:

1. **Order Confirmation** - Sent immediately after order creation
2. **Key Delivery** - Sent when order is delivered by admin
3. **Password Reset** - Sent when user requests password reset
4. **Payment Receipt** - Sent when payment is confirmed

## Testing

### Test Order Confirmation
```bash
# Order will trigger email automatically
POST /api/orders
{
  "items": [...]
}
```

### Test Password Reset
```bash
# Will send reset email
POST /api/auth/reset-password
{
  "email": "user@example.com"
}
```

### Check Mailtrap
All test emails will appear in Mailtrap inbox for inspection.

## Queue System

Emails are sent asynchronously via BullMQ queue:
- Queue name: `email`
- Retry on failure: Yes (3 attempts)
- Backoff: Exponential

Monitor queue: Use BullMQ dashboard or Redis CLI.

## Troubleshooting

### Emails not sending?
1. Check SMTP credentials in `.env`
2. Verify SMTP server is accessible
3. Check application logs for errors
4. Test with Mailtrap first

### Emails going to spam?
1. Configure SPF records for your domain
2. Set up DKIM signing
3. Use a reputable SMTP provider
4. Don't use generic "From" addresses

### Queue issues?
```bash
# Check Redis
docker compose exec redis redis-cli

# List queue
LLEN email

# Process jobs
BRPOP email 5
```
