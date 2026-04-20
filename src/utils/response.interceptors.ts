import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Response<T> {
  status: string;
  message?: string;
  count?: number;
  data: T;
}

export class ResponseWithMessage<T> {
  constructor(
    public readonly data: T,
    public readonly message?: string,
  ) {}
}

export class PaginationResponse<T> {
  constructor(
    public readonly data: T[],
    public readonly page: number,
    public readonly limit: number,
    public readonly total: number,
    public readonly message?: string,
  ) {}
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  constructor(private reflector: Reflector) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((res) => {
        const status = 'success';
        let message: string = '';
        let data: any;
        if (res instanceof ResponseWithMessage) {
          data = res.data
          message = res.message ?? '';
        }
        else if (res instanceof PaginationResponse) {
          return {
            status,
            page: res.page,
            limit: res.limit,
            total: res.total,
            data: res.data
          }
        }
        else {
          data = res;
        }
        return { status, ...(message && { message }), ...(Array.isArray(data) && { count: data.length }), data };
      }),
    );
  }
}
