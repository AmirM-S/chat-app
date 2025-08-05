import { Module } from '@nestjs/common';
import { EventListenerService } from './event-listener.service';
import { ChatHandler } from './handlers/chat.handler';
import { MessageHandler } from './handlers/message.handler';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [RedisModule, ChatModule],
  providers: [EventListenerService, ChatHandler, MessageHandler],
  exports: [EventListenerService],
})
export class EventsModule {} 