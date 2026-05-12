import { Controller, Post, Body, UseGuards, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function getCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiRegisterUser()
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Post('login')
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
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('refresh')
  @ApiRefreshTokens()
  @UseGuards(JwtRefreshAuthGuard)
  async refreshTokens(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshTokens(req.user.id);

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
      access_token: result.access_token,
    };
  }

  @Post('logout')
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

    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });

    return { message: 'Logout realizado com sucesso.' };
  }
}
