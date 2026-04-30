import { createHmac } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Profile } from 'passport-github2';
import { UserService } from '../user/user.service';

export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async githubCallback(payload: TokenPayload): Promise<AuthTokens> {
    const tokens = this.generateTokens(payload);
    const salt = this.configService.getOrThrow<string>('TOKEN_SALT');
    const hash = createHmac('sha256', salt)
      .update(tokens.refresh_token)
      .digest('hex');
    await this.userService.updateRefreshTokenHash(payload.sub, hash);
    return tokens;
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'The refresh token is invalid, expired, or revoked',
      );
    }

    const user = await this.userService.findById(payload.sub);
    if (!user?.refresh_token_hash) {
      throw new UnauthorizedException(
        'The refresh token is invalid, expired, or revoked',
      );
    }

    const salt = this.configService.getOrThrow<string>('TOKEN_SALT');
    const hash = createHmac('sha256', salt).update(token).digest('hex');

    if (hash !== user.refresh_token_hash) {
      throw new UnauthorizedException(
        'The refresh token is invalid, expired, or revoked',
      );
    }

    const tokenPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const tokens = this.generateTokens(tokenPayload);
    const newHash = createHmac('sha256', salt)
      .update(tokens.refresh_token)
      .digest('hex');
    await this.userService.updateRefreshTokenHash(user.id, newHash);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userService.updateRefreshTokenHash(userId, null);
  }

  async exchangeGithubCode(
    code: string,
    code_verifier: string,
  ): Promise<TokenPayload> {
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: this.configService.getOrThrow<string>(
            'GITHUB_OAUTH_CLIENTID',
          ),
          client_secret: this.configService.getOrThrow<string>(
            'GITHUB_OAUTH_SECRET',
          ),
          code,
          code_verifier,
        }),
      },
    );
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException('Invalid or expired GitHub code');
    }

    const authHeader = { Authorization: `Bearer ${tokenData.access_token}` };
    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: authHeader }),
      fetch('https://api.github.com/user/emails', { headers: authHeader }),
    ]);

    const githubUser = (await userRes.json()) as {
      id: number;
      login: string;
      avatar_url?: string;
    };
    const emails = (await emailsRes.json()) as {
      email: string;
      primary: boolean;
    }[];

    return this.validateUser({
      id: String(githubUser.id),
      username: githubUser.login,
      displayName: githubUser.login,
      emails: [{ value: emails.find((e) => e.primary)?.email ?? '' }],
      photos: githubUser.avatar_url ? [{ value: githubUser.avatar_url }] : [],
    } as unknown as Profile);
  }

  async validateUser(profile: Profile): Promise<TokenPayload> {
    const user = await this.userService.findOrCreateByGithubId({
      github_id: profile.id,
      username: profile.username ?? profile.displayName,
      email: profile.emails?.[0]?.value ?? '',
      avatar_url: profile.photos?.[0]?.value,
    });
    return { sub: user.id, username: user.username, role: user.role };
  }

  login(user: { username: string; userId: string }) {
    const payload = { username: user.username, sub: user.userId };
    return { access_token: this.jwtService.sign(payload) };
  }

  generateTokens(payload: TokenPayload): AuthTokens {
    const access_token = this.jwtService.sign(payload);

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { access_token, refresh_token };
  }
}
