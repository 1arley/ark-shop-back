import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from '@/auth/auth.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { ApiRegisterUser } from '@/auth/swagger/auth.post.register.swagger';
import { ApiLoginUser } from '@/auth/swagger/auth.post.login.swagger';
import { ApiRefreshTokens } from '@/auth/swagger/auth.post.refresh.swagger';
import { ApiLogoutUser } from '@/auth/swagger/auth.post.logout.swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { JwtRefreshAuthGuard } from '@/auth/jwt-refresh-auth.guard';
import { extractRefreshToken } from '@/auth/token-extractor.util';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import { ResetPasswordWithCodeDto } from '@/auth/dto/reset-password-code.dto';
import { RequestEmailChangeDto } from '@/auth/dto/request-email-change.dto';
import { ConfirmEmailChangeDto } from '@/auth/dto/confirm-email-change.dto';
import { SkipEmailVerification } from '@/auth/decorators/skip-email-verification.decorator';
import { Public } from '@/auth/decorators/public.decorator';

import { EmailVerifiedGuard } from '@/auth/email-verified.guard';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const EXPOSE_AUTH_TOKENS_IN_BODY = process.env.EXPOSE_AUTH_TOKENS_IN_RESPONSE === 'true';

function getCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: maxAgeSeconds * 1000, // Express expects milliseconds, not seconds
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiRegisterUser()
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);

    return {
      message: result.message,
      emailVerificationRequired: result.emailVerificationRequired,
    };
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 tentativas/minuto
  @ApiLoginUser()
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);

    res.cookie(
      ACCESS_TOKEN_COOKIE,
      result.access_token,
      getCookieOptions(result.access_expires_in),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refresh_token,
      getCookieOptions(result.refresh_expires_in),
    );

    return {
      user: result.user,
      emailVerified: result.emailVerified,
      // E2E/CI: expose tokens in body (production uses httpOnly cookies only)
      ...(EXPOSE_AUTH_TOKENS_IN_BODY
        ? {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          }
        : {}),
    };
  }

  @Post('refresh')
  @Public()
  @SkipEmailVerification()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 refreshes/minuto
  @ApiRefreshTokens()
  @ApiBearerAuth()
  @UseGuards(JwtRefreshAuthGuard)
  async refreshTokens(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshTokens(req.user.id, req.user.refreshToken!);

    res.cookie(
      ACCESS_TOKEN_COOKIE,
      result.access_token,
      getCookieOptions(result.access_expires_in),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refresh_token,
      getCookieOptions(result.refresh_expires_in),
    );

    return {
      user: req.user,
      ...(EXPOSE_AUTH_TOKENS_IN_BODY
        ? {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          }
        : {}),
    };
  }

  @Post('logout')
  @Public()
  @SkipEmailVerification()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiLogoutUser()
  @ApiBearerAuth()
  @UseGuards(JwtRefreshAuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = extractRefreshToken(req);

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken).catch(() => {
        // token invalid or already revoked — just clear the cookie
      });
    }

    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      path: '/',
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? ('none' as const) : ('lax' as const),
    });
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      path: '/',
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? ('none' as const) : ('lax' as const),
    });

    return { message: 'Logout realizado com sucesso.' };
  }

  @Post('forgot-password')
  @Public()
  @SkipEmailVerification()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 solicitações/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar redefinição de senha' })
  @ApiResponse({
    status: 200,
    description: 'Se o email existir, um link de redefinição será enviado.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('forgot-password-code')
  @Public()
  @SkipEmailVerification()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 solicitacoes/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset via OTP code' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset code will be sent.',
  })
  forgotPasswordWithCode(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPasswordWithCode(dto.email);
  }

  @Post('reset-password-code')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com codigo OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code.' })
  resetPasswordWithCode(@Body() dto: ResetPasswordWithCodeDto) {
    return this.authService.resetPasswordWithCode(dto);
  }

  @Post('verify-email')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar email com codigo recebido' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code.' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Public()
  @SkipEmailVerification()
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Se o email existir, um novo codigo sera enviado.',
  })
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Post('change-email')
  @SkipEmailVerification()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar alteracao de email' })
  @ApiResponse({
    status: 200,
    description: 'Codigo de confirmacao enviado para o novo email.',
  })
  @ApiResponse({ status: 409, description: 'Email ja em uso.' })
  requestEmailChange(@Req() req: AuthenticatedRequest, @Body() dto: RequestEmailChangeDto) {
    return this.authService.requestEmailChange(req.user.id, dto.newEmail);
  }

  @Post('confirm-email-change')
  @SkipEmailVerification()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar alteracao de email com codigo' })
  @ApiResponse({ status: 200, description: 'Email alterado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Codigo invalido ou expirado.' })
  confirmEmailChange(@Req() req: AuthenticatedRequest, @Body() dto: ConfirmEmailChangeDto) {
    return this.authService.confirmEmailChange(req.user.id, dto);
  }
  @Get('me')
  @UseGuards(EmailVerifiedGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Email not verified' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.validateUser(req.user.id);
  }

  @Get('verification-status')
  @SkipEmailVerification()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Get email verification status' })
  @ApiResponse({ status: 200, description: 'Verification status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getVerificationStatus(@Req() req: AuthenticatedRequest) {
    return this.authService.getVerificationStatus(req.user.id);
  }
}
