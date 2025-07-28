import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://guest:guest@localhost:5673'],
        queue: 'chat-messages',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
  console.log('[Chat-Service] Listening to RabbitMQ...');
}

bootstrap();
