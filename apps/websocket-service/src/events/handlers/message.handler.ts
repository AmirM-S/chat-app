import { Injectable, Logger } from '@nestjs/common';
import { ChatGateway } from '../../chat/chat.gateway';
import { RedisService } from '../../redis/redis.service';
import { MessageData } from '../../chat/dto/message.dto';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly redisService: RedisService,
  ) {}

  async handleMessageCreated(message: MessageData): Promise<void> {
    try {
      this.logger.debug(`Handling message created: ${message.id}`, message);

      // Store message in Redis
      await this.redisService.hset(
        `chat:${message.chatId}:messages`,
        message.id,
        message
      );

      // Update chat last message
      await this.redisService.hset(
        `chat:${message.chatId}`,
        'lastMessage',
        {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          timestamp: message.timestamp,
        }
      );

      // Broadcast message to chat room
      await this.chatGateway.broadcastMessage(message.chatId, message);

      // Update message count
      await this.incrementMessageCount(message.chatId);

    } catch (error) {
      this.logger.error('Error handling message created:', error);
    }
  }

  async handleMessageUpdated(messageId: string, chatId: string, updates: Partial<MessageData>): Promise<void> {
    try {
      this.logger.debug(`Handling message updated: ${messageId}`, updates);

      // Get existing message
      const message = await this.redisService.hget<MessageData>(
        `chat:${chatId}:messages`,
        messageId
      );

      if (message) {
        // Update message
        const updatedMessage = { ...message, ...updates, edited: true, editedAt: new Date() };
        await this.redisService.hset(
          `chat:${chatId}:messages`,
          messageId,
          updatedMessage
        );

        // Broadcast update
        await this.chatGateway.broadcastChatEvent('message_updated', {
          messageId,
          chatId,
          updates,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      this.logger.error('Error handling message updated:', error);
    }
  }

  async handleMessageDeleted(messageId: string, chatId: string, userId: string): Promise<void> {
    try {
      this.logger.debug(`Handling message deleted: ${messageId}`);

      // Get message to check ownership
      const message = await this.redisService.hget<MessageData>(
        `chat:${chatId}:messages`,
        messageId
      );

      if (message && message.senderId === userId) {
        // Mark as deleted
        const updatedMessage = { 
          ...message, 
          deleted: true, 
          deletedAt: new Date(),
          content: '[Message deleted]'
        };
        
        await this.redisService.hset(
          `chat:${chatId}:messages`,
          messageId,
          updatedMessage
        );

        // Broadcast deletion
        await this.chatGateway.broadcastChatEvent('message_deleted', {
          messageId,
          chatId,
          userId,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      this.logger.error('Error handling message deleted:', error);
    }
  }

  async handleMessageReaction(
    messageId: string, 
    chatId: string, 
    reaction: string, 
    userId: string, 
    action: 'add' | 'remove'
  ): Promise<void> {
    try {
      this.logger.debug(`Handling message reaction: ${messageId} ${action} ${reaction}`);

      const message = await this.redisService.hget<MessageData>(
        `chat:${chatId}:messages`,
        messageId
      );

      if (message) {
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[reaction]) message.reactions[reaction] = [];

        if (action === 'add' && !message.reactions[reaction].includes(userId)) {
          message.reactions[reaction].push(userId);
        } else if (action === 'remove') {
          message.reactions[reaction] = message.reactions[reaction].filter(id => id !== userId);
        }

        await this.redisService.hset(
          `chat:${chatId}:messages`,
          messageId,
          message
        );

        // Broadcast reaction
        await this.chatGateway.broadcastChatEvent('message_reaction', {
          messageId,
          chatId,
          reaction,
          userId,
          action,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      this.logger.error('Error handling message reaction:', error);
    }
  }

  private async incrementMessageCount(chatId: string): Promise<void> {
    try {
      const countKey = `chat:${chatId}:message_count`;
      await this.redisService.incr(countKey);
    } catch (error) {
      this.logger.error('Error incrementing message count:', error);
    }
  }
} 