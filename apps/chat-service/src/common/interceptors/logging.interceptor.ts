import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): any {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();

    const observable = next.handle() as any;

    return observable.pipe(
      tap((data: any) => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `${method} ${url} - ${duration}ms - Body: ${JSON.stringify(body)} - Query: ${JSON.stringify(query)} - Params: ${JSON.stringify(params)}`,
        );
      }),
    );
  }
}
