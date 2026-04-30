import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from 'src/shared/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PkceGuard } from './guard/pkce.guard';
import { GithubStrategy } from './strategy/github.strategy';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  providers: [
    AuthService,
    PkceGuard,
    GithubStrategy,
    JwtStrategy,
    PrismaService,
  ],
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
})
export class AuthModule {}
