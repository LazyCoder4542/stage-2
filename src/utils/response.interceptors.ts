import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  status: string;
  message?: string;
  count?: number;
  data?: T;
}

export class DataWithMessage<T> {
  constructor(
    public readonly data: T,
    public readonly message?: string,
  ) {}
}

interface PaginationResponseLinks {
  self: string;
  next: string | null;
  prev: string | null;
}

export class PaginationResponse<T> {
  constructor(
    public readonly data: T[],
    public readonly page: number,
    public readonly limit: number,
    public readonly total: number,
    public readonly total_pages: number,
    public readonly links: PaginationResponseLinks,
    public readonly message?: string,
  ) {}
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((res: DataWithMessage<T> | PaginationResponse<T> | T) => {
        const status = 'success';
        let message: string = '';
        let data: T | T[];
        if (res instanceof DataWithMessage) {
          data = res.data;
          message = res.message ?? '';
        } else if (res instanceof PaginationResponse) {
          return {
            status,
            page: res.page,
            limit: res.limit,
            total: res.total,
            total_pages: res.total_pages,
            links: res.links,
            data: res.data,
            ...(res.message && { message: res.message }),
          } as unknown as Response<T>;
        } else if (typeof res === 'object' && res !== null) {
          return {
            status,
            ...res,
          } as Response<T>;
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
