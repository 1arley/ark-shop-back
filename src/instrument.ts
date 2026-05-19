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
      // Scrub sensitive fields from request body (LGPD/GDPR compliance)
      if (event.request?.data && typeof event.request.data === 'object') {
        const sensitiveFields = [
          'password',
          'token',
          'secret',
          'creditCard',
          'ssn',
          'apiKey',
          'refresh_token',
          'access_token',
          'cpf',
          'cpfCnpj',
          'keyData',
          'pixCode',
          'pixQrCode',
          'code',
          'KEYS_ENCRYPTION_KEY',
        ];
        const scrub = (value: unknown): unknown => {
          if (Array.isArray(value)) {
            return value.map(scrub);
          }
          if (value && typeof value === 'object') {
            const record = value as Record<string, unknown>;
            for (const [key, nested] of Object.entries(record)) {
              if (sensitiveFields.includes(key)) {
                record[key] = '[Filtered]';
              } else {
                record[key] = scrub(nested);
              }
            }
          }
          return value;
        };
        scrub(event.request.data);
      }
      return event;
    },
    tracesSampleRate: Math.min(
      1,
      Math.max(0, parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1') || 0.1),
    ),
  });
}
