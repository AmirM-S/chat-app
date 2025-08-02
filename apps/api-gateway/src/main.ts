import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // API Documentation
  const config = new DocumentBuilder()
    .setTitle('Chat App API Gateway')
    .setDescription('REST API for Chat Application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health check endpoint
  app.use('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}`);
  console.log(`📚 API Docs available at http://localhost:${port}/api/docs`);
}
bootstrap();