import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessage, ChatMessageSchema } from './chat.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  providers: [ChatService],
  controllers: [ChatService],
})
export class ChatModule {}
