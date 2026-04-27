import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;

    console.log(exception);
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const raw = (res as Record<string, unknown>).message;
        message = Array.isArray(raw)
          ? (raw as string[]).join(', ')
          : String(raw);
      } else {
        message = exception.message;
      }
    } else {
      message = 'Internal Server Error';
    }

    response.status(status).json({
      status: 'error',
      message,
    });
  }
}
