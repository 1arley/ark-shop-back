import { Request } from 'express';
import type { UserProfile } from '@/common/interfaces/user-profile.interface';

export interface AuthenticatedUser extends UserProfile {
  /** Raw refresh token value (available only on /refresh endpoint). */
  refreshToken?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
