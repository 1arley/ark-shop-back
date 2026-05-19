import { Prisma } from '@prisma/client';

/** Safe user fields for API responses (never includes password). */
export const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserPublic = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

/** Minimal lookup for existence / uniqueness checks. */
export const userExistsSelect = {
  id: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;
