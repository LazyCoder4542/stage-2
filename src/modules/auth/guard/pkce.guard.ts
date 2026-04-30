import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class PkceGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const { code, code_verifier, code_challenge, is_cli } = req.query as Record<
      string,
      string
    >;

    if (is_cli !== 'true') return true;
    console.log({code, code_verifier, code_challenge})
    if (!code || !code_verifier || !code_challenge) {
      throw new UnauthorizedException('Invalid or expired GitHub code');
    }

    const expected = createHash('sha256')
    .update(code_verifier)
    .digest('base64url');
    
    if (expected !== code_challenge) {
      throw new UnauthorizedException('Invalid or expired GitHub code');
    }

    req.user = await this.authService.exchangeGithubCode(code, code_verifier);
    return true;
  }
}
