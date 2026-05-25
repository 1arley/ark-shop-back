import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from '@/auth/auth.service';
import { AuthController } from '@/auth/auth.controller';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { JwtRefreshStrategy } from '@/auth/jwt-refresh.strategy';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '@/auth/email-verified.guard';
import { RolesGuard } from '@/auth/roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    // Global guards enforce authentication and email verification by default.
    // Use @Public() to bypass both guards (e.g., login, register).
    // Use @SkipEmailVerification() to bypass only EmailVerifiedGuard (e.g., token refresh).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    RolesGuard,
  ],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
