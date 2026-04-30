import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from 'src/decorators/public';
import { GithubAuthGuard } from './guard/github.guard';
import { PkceGuard } from './guard/pkce.guard';
import { AuthService, AuthTokens } from './auth.service';
import type { Request } from 'express';
import { GithubCallbackResponse } from './dto/githubCallback.dto';

@ApiTags('Auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('/github')
  @ApiOperation({
    summary: 'Initiate GitHub OAuth',
    description:
      "Redirects the browser to GitHub's authorization page. Pass `is_cli=true` for CLI flow.",
  })
  @ApiQuery({
    name: 'is_cli',
    required: false,
    type: Boolean,
    description: 'Set true for CLI flow',
  })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub OAuth' })
  githubRedirect() {
    return {};
  }

  @Public()
  @Get('/github/callback')
  @ApiOperation({
    summary: 'GitHub OAuth callback',
    description:
      'GitHub redirects here after authorization. Routes to CLI local server if `is_cli=true`, otherwise redirects to the frontend callback URL.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to frontend or CLI local server with code',
  })
  githubCallback(@Res() res, @Query() query: GithubCallbackResponse) {
    if (query.is_cli) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return res.redirect(
        `http://localhost:${process.env.CLI_PORT}/callback?code=${query.code}&state=${query.state}`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return res.redirect(
      `${process.env.FRONTEND_URL}/callback?code=${query.code}&state=${query.state}`,
    );
  }

  @Public()
  @UseGuards(PkceGuard, GithubAuthGuard)
  @Get('/github/exchange')
  @ApiOperation({
    summary: 'Exchange GitHub code for JWT tokens',
    description:
      'Exchanges the GitHub authorization code for access and refresh tokens. CLI requests must include `code_verifier` and `is_cli=true` for PKCE verification.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'GitHub authorization code',
  })
  @ApiQuery({
    name: 'is_cli',
    required: false,
    type: Boolean,
    description: 'Set true for CLI flow (enables PKCE)',
  })
  @ApiQuery({
    name: 'code_verifier',
    required: false,
    description: 'PKCE code verifier (required if is_cli=true)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'OAuth state (required if is_cli=true for PKCE)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns access_token and refresh_token',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired GitHub code' })
  async githubExchange(@Req() req: Request) {
    return this.authService.githubCallback(req.user!);
  }

  @Public()
  @Post('/refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Issues a new access and refresh token pair. Invalidates the old refresh token.',
  })
  @ApiBody({
    schema: {
      properties: { refresh_token: { type: 'string' } },
      required: ['refresh_token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'New access_token and refresh_token',
  })
  @ApiResponse({
    status: 401,
    description: 'The refresh token is invalid, expired, or revoked',
  })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    const data: AuthTokens = await this.authService.refreshToken(refreshToken);
    return data;
  }

  @Post('/logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revokes the refresh token. The access token remains valid until it expires.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request) {
    await this.authService.logout(req.user!.sub);
  }
}
