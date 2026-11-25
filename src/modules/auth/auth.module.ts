import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { authConfig } from '../../config/auth.config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordService } from './password.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

/**
 * Global so any feature module can protect routes with `@Auth()` without importing
 * this module (the guards need `TokenService` and `UsersService`).
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(authConfig), JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    RefreshTokenRepository,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [TokenService, UsersModule],
})
export class AuthModule {}
