import { Controller, Post, Body, UseGuards, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
import { SkipEmailVerification } from '@/auth/decorators/skip-email-verification.decorator';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const EXPOSE_AUTH_TOKENS_IN_BODY = process.env.EXPOSE_AUTH_TOKENS_IN_RESPONSE === 'true';

function getCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

@ApiTags('auth')
@SkipEmailVerification()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiRegisterUser()
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);

    return {
      message: result.message,
      user: result.user,
      emailVerificationRequired: result.emailVerificationRequired,
    };
  }

  @Post('login')
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
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 refreshes/minuto
  @ApiRefreshTokens()
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
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiLogoutUser()
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = extractRefreshToken(req);

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken).catch(() => {
        // token invalido ou ja revogado — apenas limpa o cookie
      });
    }

    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      path: '/',
      secure: IS_PRODUCTION,
      sameSite: 'lax' as const,
    });
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: '/',
      secure: IS_PRODUCTION,
      sameSite: 'lax' as const,
    });

    return { message: 'Logout realizado com sucesso.' };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 solicitações/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar redefinição de senha' })
  @ApiResponse({
    status: 200,
    description: 'Se o email existir, um link de redefinição será enviado.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso.' })
  @ApiResponse({ status: 400, description: 'Token invalido ou expirado.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('forgot-password-code')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 solicitacoes/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar redefinicao de senha via codigo OTP' })
  @ApiResponse({
    status: 200,
    description: 'Se o email existir, um codigo de redefinicao sera enviado.',
  })
  async forgotPasswordWithCode(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPasswordWithCode(dto.email);
  }

  @Post('reset-password-code')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com codigo OTP' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso.' })
  @ApiResponse({ status: 400, description: 'Codigo invalido ou expirado.' })
  async resetPasswordWithCode(@Body() dto: ResetPasswordWithCodeDto) {
    return this.authService.resetPasswordWithCode(dto);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar email com codigo recebido' })
  @ApiResponse({ status: 200, description: 'Email verificado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Codigo de verificacao invalido ou expirado.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 solicitacoes/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar email de verificacao' })
  @ApiResponse({
    status: 200,
    description: 'Se o email existir, um novo codigo sera enviado.',
  })
  async resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }
}
