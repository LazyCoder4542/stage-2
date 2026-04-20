import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;

    console.log(exception);
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message ?? exception.message;
    } else {
      message = 'Internal Server Error';
    }

    response.status(status).json({
      status: 'error',
      message,
    });
  }
}
