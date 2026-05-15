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
    // Não enviar PII automaticamente para estar em conformidade com LGPD/GDPR
    sendDefaultPii: false,
    beforeSend(event) {
      // Remove headers sensíveis antes de enviar ao Sentry
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      return event;
    },
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  });
}
