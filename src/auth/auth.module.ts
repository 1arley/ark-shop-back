import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { AuthRegistrationService } from '@/auth/auth-registration.service';
import { AuthSessionService } from '@/auth/auth-session.service';
import { AuthPasswordService } from '@/auth/auth-password.service';
import { AuthTokenService } from '@/auth/auth-token.service';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { JwtRefreshStrategy } from '@/auth/jwt-refresh.strategy';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { PrismaModule } from '@/prisma/prisma.module';
import { EmailModule } from '@/modules/email/email.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), PrismaModule, EmailModule],
  controllers: [AuthController],
  providers: [
    // Auth Service (facade — backward compatible)
    AuthService,
    // Focused sub-services
    AuthRegistrationService,
    AuthSessionService,
    AuthPasswordService,
    AuthTokenService,
    // Strategies & Guards
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    AuthRegistrationService,
    AuthSessionService,
    AuthPasswordService,
    AuthTokenService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
