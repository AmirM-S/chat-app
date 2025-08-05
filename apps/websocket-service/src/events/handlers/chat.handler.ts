import { Injectable, Logger } from '@nestjs/common';
import { ChatGateway } from '../../chat/chat.gateway';
import { RedisService } from '../../redis/redis.service';
import { ChatEvent } from '../../chat/interfaces/chat.interface';

@Injectable()
export class ChatHandler {
  private readonly logger = new Logger(ChatHandler.name);

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly redisService: RedisService,
  ) {}

  async handleChatEvent(event: ChatEvent): Promise<void> {
    try {
      this.logger.debug(`Handling chat event: ${event.type}`, event);

      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event);
          break;
        case 'typing':
          await this.handleTypingEvent(event);
          break;
        case 'presence':
          await this.handlePresenceEvent(event);
          break;
        case 'reaction':
          await this.handleReactionEvent(event);
          break;
        case 'edit':
          await this.handleEditEvent(event);
          break;
        case 'delete':
          await this.handleDeleteEvent(event);
          break;
        default:
          this.logger.warn(`Unknown chat event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling chat event:', error);
    }
  }

  private async handleMessageEvent(event: ChatEvent): Promise<void> {
    const { chatId, message } = event.data;
    
    // Store message in Redis
    await this.redisService.hset(
      `chat:${chatId}:messages`,
      message.id,
      message
    );

    // Broadcast to chat room
    await this.chatGateway.broadcastMessage(chatId, message);
  }

  private async handleTypingEvent(event: ChatEvent): Promise<void> {
    const { chatId, userId, isTyping } = event.data;
    
    // Broadcast typing indicator
    await this.chatGateway.broadcastChatEvent('typing', {
      userId,
      isTyping,
      chatId,
      timestamp: new Date(),
    });
  }

  private async handlePresenceEvent(event: ChatEvent): Promise<void> {
    const { userId, status, chatId } = event.data;
    
    // Update user presence
    await this.redisService.hset(
      `user:${userId}:presence`,
      'status',
      status
    );

    // Broadcast presence update
    await this.chatGateway.broadcastChatEvent('presence', {
      userId,
      status,
      chatId,
      timestamp: new Date(),
    });
  }

  private async handleReactionEvent(event: ChatEvent): Promise<void> {
    const { messageId, chatId, reaction, userId } = event.data;
    
    // Update message reactions
    const messageKey = `chat:${chatId}:messages:${messageId}`;
    const message = await this.redisService.get(messageKey);
    
    if (message) {
      if (!message.reactions) message.reactions = {};
      if (!message.reactions[reaction]) message.reactions[reaction] = [];
      
      if (!message.reactions[reaction].includes(userId)) {
        message.reactions[reaction].push(userId);
        await this.redisService.set(messageKey, message);
      }
    }

    // Broadcast reaction
    await this.chatGateway.broadcastChatEvent('reaction', {
      messageId,
      reaction,
      userId,
      chatId,
      timestamp: new Date(),
    });
  }

  private async handleEditEvent(event: ChatEvent): Promise<void> {
    const { messageId, chatId, content, userId } = event.data;
    
    // Update message content
    const messageKey = `chat:${chatId}:messages:${messageId}`;
    const message = await this.redisService.get(messageKey);
    
    if (message && message.senderId === userId) {
      message.content = content;
      message.edited = true;
      message.editedAt = new Date();
      await this.redisService.set(messageKey, message);
    }

    // Broadcast edit
    await this.chatGateway.broadcastChatEvent('edit', {
      messageId,
      content,
      userId,
      chatId,
      timestamp: new Date(),
    });
  }

  private async handleDeleteEvent(event: ChatEvent): Promise<void> {
    const { messageId, chatId, userId } = event.data;
    
    // Mark message as deleted
    const messageKey = `chat:${chatId}:messages:${messageId}`;
    const message = await this.redisService.get(messageKey);
    
    if (message && message.senderId === userId) {
      message.deleted = true;
      message.deletedAt = new Date();
      await this.redisService.set(messageKey, message);
    }

    // Broadcast deletion
    await this.chatGateway.broadcastChatEvent('delete', {
      messageId,
      userId,
      chatId,
      timestamp: new Date(),
    });
  }
} 