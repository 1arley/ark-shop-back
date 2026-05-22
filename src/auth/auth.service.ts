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
  register(registerDto: RegisterDto) {
    return this.registration.register(registerDto);
  }

  verifyEmail(dto: VerifyEmailDto) {
    return this.registration.verifyEmail(dto);
  }

  resendVerificationEmail(email: string) {
    return this.registration.resendVerificationEmail(email);
  }

  // ─── Session ────────────────────────────────────────────────────
  login(loginDto: LoginDto) {
    return this.session.login(loginDto);
  }

  refreshTokens(userId: string, oldRefreshToken: string) {
    return this.session.refreshTokens(userId, oldRefreshToken);
  }

  validateUser(userId: string) {
    return this.session.validateUser(userId);
  }

  getVerificationStatus(userId: string) {
    return this.session.getVerificationStatus(userId);
  }

  // ─── Password ───────────────────────────────────────────────────
  forgotPassword(email: string) {
    return this.password.forgotPassword(email);
  }

  forgotPasswordWithCode(email: string) {
    return this.password.forgotPasswordWithCode(email);
  }

  resetPassword(dto: ResetPasswordDto) {
    return this.password.resetPassword(dto);
  }

  resetPasswordWithCode(dto: ResetPasswordWithCodeDto) {
    return this.password.resetPasswordWithCode(dto);
  }

  // ─── Token Management ──────────────────────────────────────────
  revokeRefreshToken(token: string) {
    return this.tokens.revokeRefreshToken(token);
  }
}
