import { Injectable } from '@nestjs/common';
import { AuthRegistrationService } from '@/auth/auth-registration.service';
import { AuthSessionService } from '@/auth/auth-session.service';
import { AuthPasswordService } from '@/auth/auth-password.service';
import { AuthTokenService } from '@/auth/auth-token.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import { ResetPasswordWithCodeDto } from '@/auth/dto/reset-password-code.dto';
import type {
  RegisterResult,
  LoginResult,
  TokenPairResult,
  EmailVerificationResult,
  MessageResult,
  VerificationStatusResult,
} from '@/auth/interfaces/auth-results.interface';
import type { UserPublic } from '@/common/prisma/user-public.select';

/**
 * AuthService — thin facade over focused sub-services.
 *
 * Delegates each concern to a dedicated service:
 *   - AuthRegistrationService  : registration, email verification
 *   - AuthSessionService       : login, logout, refresh, user queries
 *   - AuthPasswordService      : forgot/reset password flows
 *   - AuthTokenService         : JWT generation & refresh token CRUD
 *
 * This class is kept for backward compatibility (exported by AuthModule).
 * New consumers should inject the specific sub-service they need.
 */
@Injectable()
export class AuthService {
  constructor(
    public readonly registration: AuthRegistrationService,
    public readonly session: AuthSessionService,
    public readonly password: AuthPasswordService,
    public readonly tokens: AuthTokenService,
  ) {}

  // ─── Registration & Email Verification ──────────────────────────
  register(registerDto: RegisterDto): Promise<RegisterResult> {
    return this.registration.register(registerDto);
  }

  verifyEmail(dto: VerifyEmailDto): Promise<EmailVerificationResult> {
    return this.registration.verifyEmail(dto);
  }

  resendVerificationEmail(email: string): Promise<MessageResult | EmailVerificationResult> {
    return this.registration.resendVerificationEmail(email);
  }

  // ─── Session ────────────────────────────────────────────────────
  login(loginDto: LoginDto): Promise<LoginResult> {
    return this.session.login(loginDto);
  }

  refreshTokens(userId: string, oldRefreshToken: string): Promise<TokenPairResult> {
    return this.session.refreshTokens(userId, oldRefreshToken);
  }

  validateUser(userId: string): Promise<UserPublic> {
    return this.session.validateUser(userId);
  }

  getVerificationStatus(userId: string): Promise<VerificationStatusResult> {
    return this.session.getVerificationStatus(userId);
  }

  // ─── Password ───────────────────────────────────────────────────
  forgotPassword(email: string): Promise<MessageResult> {
    return this.password.forgotPassword(email);
  }

  forgotPasswordWithCode(email: string): Promise<MessageResult> {
    return this.password.forgotPasswordWithCode(email);
  }

  resetPassword(dto: ResetPasswordDto): Promise<MessageResult> {
    return this.password.resetPassword(dto);
  }

  resetPasswordWithCode(dto: ResetPasswordWithCodeDto): Promise<MessageResult> {
    return this.password.resetPasswordWithCode(dto);
  }

  // ─── Token Management ──────────────────────────────────────────
  revokeRefreshToken(token: string): Promise<void> {
    return this.tokens.revokeRefreshToken(token);
  }
}
