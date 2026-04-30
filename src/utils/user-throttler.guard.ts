import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const request = req as unknown as Request;
    return Promise.resolve(request.user?.sub ?? request.ip ?? 'anonymous');
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Record<string, any>>();
    return { req, res };
  }
}
