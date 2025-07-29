import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import * as dotenv from 'dotenv';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';

dotenv.config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat-service'),
    ChatModule,
  ],
  providers: [RabbitMQService],
})
export class AppModule {}
