/**
 * JWT payload — data embedded in every access & refresh token.
 *
 * Design rationale:
 * - Includes enough user data to avoid a DB query on every request (N+1 fix).
 * - `emailVerified` and `role` are embedded so guards (EmailVerifiedGuard,
 *   RolesGuard) can enforce policies without touching the database.
 * - For real-time ban enforcement, add a Redis deny-list check in guards
 *   rather than reverting to per-request DB lookups.
 */
export interface JwtPayload {
  /** User ID (primary key in the users table). */
  sub: string;

  /** User role — one of USER, ADMIN, SUPERADMIN. */
  role: string;

  /** JWT unique identifier (used for refresh token rotation). */
  jti: string;

  /** User email — embedded to avoid a DB lookup in guards & controllers. */
  email: string;

  /** Whether the user's email is verified. */
  emailVerified: boolean;

  /** Display name (nullable — user may not have set it yet). */
  name: string | null;
}
