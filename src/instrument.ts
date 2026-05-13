// ============================================
// Sentry SDK — Error Tracking Initialization
// ============================================
// Only initializes if SENTRY_DSN is configured.
// The app works normally without it (14-day trial).
// ============================================

import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: true,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });
}
