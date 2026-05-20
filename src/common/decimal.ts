import { Prisma } from '@prisma/client';

/**
 * Safely convert a Prisma Decimal (or plain number) to a JavaScript number.
 * In production, Prisma returns `Prisma.Decimal` objects with `.toNumber()`.
 * In tests, mocks often return plain `number` values.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return Number(value);
}
