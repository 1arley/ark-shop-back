export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_PAGE = 1;
export const MAX_PAGE_SIZE = 100;

// ─── Upload ────────────────────────────────────────────────────
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_MULTIPLE_FILES = 10;
export const ALLOWED_MIME_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
export const ALLOWED_MIME_REGEX = /image\/(jpeg|png|webp|gif)/;

// ─── Time constants ────────────────────────────────────────────
export const HOUR_IN_MS = 60 * 60 * 1000;
export const DAY_IN_MS = 24 * HOUR_IN_MS;
export const MINUTE_IN_MS = 60 * 1000;

// ─── Payments ──────────────────────────────────────────────────
export const DEFAULT_PLATFORM_COMMISSION = 10; // %

// ─── Auth ──────────────────────────────────────────────────────
export const DEFAULT_BCRYPT_SALT_ROUNDS = 12;
export const PASSWORD_RESET_EXPIRY_HOURS = 1;

// ─── Database ──────────────────────────────────────────────────
export const DB_CONNECTION_TIMEOUT_MS = 10_000;

export function parsePageParam(value: string | undefined, defaultValue: number): number {
  const parsed = parseInt(value ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, MAX_PAGE_SIZE);
}
