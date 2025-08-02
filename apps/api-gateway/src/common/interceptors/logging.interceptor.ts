import { 
  Injectable, 
  NestInterceptor, 
  ExecutionContext, 
  CallHandler, 
  Logger 
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;
    
    const now = Date.now();
    
    this.logger.log(
      `${method} ${url} - ${userAgent} ${ip} - START`
    );

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const contentLength = response.get('content-length');
        const responseTime = Date.now() - now;
        
        this.logger.log(
          `${method} ${url} ${statusCode} ${contentLength || 0}b - ${responseTime}ms`
        );
      }),
    );
  }
}