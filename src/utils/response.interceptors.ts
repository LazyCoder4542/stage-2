import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  constructor(private reflector: Reflector) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((res: ResponseWithMessage<T> | PaginationResponse<T> | T) => {
        const status = 'success';
        let message: string = '';
        let data: T | T[];
        if (res instanceof ResponseWithMessage) {
          data = res.data;
          message = res.message ?? '';
        } else if (res instanceof PaginationResponse) {
          return {
            status,
            page: res.page,
            limit: res.limit,
            total: res.total,
            data: res.data,
          } as unknown as Response<T>;
        } else {
          data = res;
        }
        return {
          status,
          ...(message && { message }),
          ...(Array.isArray(data) && { count: (data as T[]).length }),
          data,
        } as Response<T>;
      }),
    );
  }
}
