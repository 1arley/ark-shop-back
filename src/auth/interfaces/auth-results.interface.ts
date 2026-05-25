import type { UserPublic } from '@/common/prisma/user-public.select';

/**
 * Result returned on successful registration request.
 * The actual user is created only after email verification.
 */
export interface RegisterResult {
  message: string;
  emailVerificationRequired: boolean;
}

/**
 * Result returned on successful login.
 */
export interface LoginResult {
  access_token: string;
  refresh_token: string;
  access_expires_in: number;
  refresh_expires_in: number;
  remember_me: boolean;
  user: UserPublic;
  emailVerified: boolean;
}

/**
 * Token pair returned by generateTokenPair and refreshTokens.
 */
export interface TokenPairResult {
  access_token: string;
  refresh_token: string;
  access_expires_in: number;
  refresh_expires_in: number;
  remember_me: boolean;
}

/**
 * Generic message-only result (for password flows, email verification).
 */
export interface MessageResult {
  message: string;
}

/**
 * Email verification status result.
 */
export interface EmailVerificationResult {
  message: string;
  emailVerified?: boolean;
}

/**
 * Verification status query result.
 */
export interface VerificationStatusResult {
  email: string;
  emailVerified: boolean;
}
