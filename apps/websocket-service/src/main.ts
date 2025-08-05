import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import { AppModule } from './app.module';
import { WsExceptionFilter } from './shared/filters/ws-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('WebSocketService');

  // Global pipes and filters
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new WsExceptionFilter());

  // Redis adapter for scaling
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // CORS configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    credentials: true,
  });

  const port = configService.get('PORT', 3003);
  await app.listen(port);

  logger.log(`🚀 WebSocket Service running on port ${port}`);
  logger.log(`🔗 Socket.IO endpoint: ws://localhost:${port}`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting server:', error);
  process.exit(1);
});