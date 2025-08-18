import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatDocument } from '../chat/schemas/chat.schema';
import { MessageDocument } from '../chat/schemas/message.schema';

@Injectable()
export class EventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  emitChatCreated(chat: ChatDocument): void {
    this.eventEmitter.emit('chat.created', chat);
  }

  emitChatUpdated(chat: ChatDocument): void {
    this.eventEmitter.emit('chat.updated', chat);
  }

  emitMessageSent(message: MessageDocument): void {
    this.eventEmitter.emit('message.sent', message);
  }

  emitMessageUpdated(message: MessageDocument): void {
    this.eventEmitter.emit('message.updated', message);
  }

  emitMessagesRead(
    chatId: string,
    userId: string,
    messageIds?: string[],
  ): void {
    this.eventEmitter.emit('messages.read', { chatId, userId, messageIds });
  }

  emitUserJoinedChat(chatId: string, userId: string): void {
    this.eventEmitter.emit('user.joined.chat', { chatId, userId });
  }

  emitUserLeftChat(chatId: string, userId: string): void {
    this.eventEmitter.emit('user.left.chat', { chatId, userId });
  }
}
