import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_OAUTH_CLIENTID')!,
      clientSecret: configService.get<string>('GITHUB_OAUTH_SECRET')!,
      callbackURL: 'http://127.0.0.1:3000/api/auth/github/callback',
      scope: ['user:email'],
      // passReqToCallback: true
    });
  }

  async validate(accessToken: string, _refreshToken: string, profile: Profile) {
    return this.authService.validateUser(profile);
  }
}
