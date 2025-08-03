import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('ChatService');
  
  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global configuration
  app.setGlobalPrefix('api/v1');
  
  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // CORS
  app.enableCors({
    origin: configService.get<string>('ALLOWED_ORIGINS')?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Chat Service API')
      .setDescription('Real-time chat service for microservices architecture')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('chats', 'Chat management operations')
      .addTag('messages', 'Message operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Microservice configuration
  const microservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672'],
      queue: 'chat_queue',
      queueOptions: {
        durable: true,
      },
      prefetchCount: 10,
    },
  });

  // Start both HTTP and microservice
  await app.startAllMicroservices();
  
  const port = configService.get<number>('PORT') || 3002;
  await app.listen(port);

  logger.log(`🚀 Chat Service is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting chat service:', error);
  process.exit(1);
});