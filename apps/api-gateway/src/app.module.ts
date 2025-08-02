import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Controllers
import { AppController } from './app.controller';
import { AuthController } from './auth/auth.controller';
import { ChatController } from './chat/chat.controller';
import { UserController } from './user/user.controller';

// Services  
import { AppService } from './app.service';
import { ProxyService } from './proxy/proxy.service';

// Guards & Interceptors
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
  ],
  controllers: [
    AppController,
    AuthController,
    ChatController,
    UserController,
  ],
  providers: [
    AppService,
    ProxyService,
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}