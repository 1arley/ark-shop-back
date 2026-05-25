/**
 * Safely convert a Prisma Decimal (or plain number) to a JavaScript number.
 * In production, Prisma returns Decimal objects with `.toNumber()`.
 * In tests, mocks often return plain `number` values.
 */
export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  // Check for Prisma Decimal-like object with toNumber method
  if (typeof (value as any).toNumber === 'function') {
    return (value as any).toNumber();
  }
  // Fallback: attempt numeric conversion
  const num = Number(value as any);
  return isNaN(num) ? null : num;
}
