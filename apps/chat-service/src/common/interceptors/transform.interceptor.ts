import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import { ApiResponse } from '../interfaces/api-response.interface';
  
  @Injectable()
  export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
      return next.handle().pipe(
        map((data) => {
          // If data is already in ApiResponse format, return as is
          if (data && typeof data === 'object' && 'success' in data) {
            return {
              ...data,
              timestamp: new Date(),
            };
          }
  
          // Transform raw data to ApiResponse format
          return {
            success: true,
            statusCode: context.switchToHttp().getResponse().statusCode || 200,
            message: 'Operation completed successfully',
            data,
            timestamp: new Date(),
          };
        }),
      );
    }
  }