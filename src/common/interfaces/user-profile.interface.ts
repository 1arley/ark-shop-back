import { Role } from '@prisma/client';

/**
 * UserProfile — minimal user data embedded in JWT tokens and HTTP requests.
 *
 * This is a subset of the Prisma User model containing only the fields
 * needed for authorization and display on every authenticated request.
 * It avoids N+1 database lookups in guards and controllers.
 */
export interface UserProfile {
  /** Primary key from the users table. */
  id: string;

  /** User email address. */
  email: string;

  /** User role — one of USER, ADMIN, SUPERADMIN. */
  role: Role;

  /** Display name (nullable — user may not have set it yet). */
  name: string | null;

  /** Whether the user's email is verified. */
  emailVerified: boolean;
}
