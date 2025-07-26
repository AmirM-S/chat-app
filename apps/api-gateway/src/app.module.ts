import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat/chat.gateway';
import { Message, MessageSchema } from './chat/message.schema';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://127.0.0.1:27017/chat-app'),
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway],
})
export class AppModule {}