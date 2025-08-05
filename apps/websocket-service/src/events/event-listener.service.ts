import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { ChatGateway } from '../chat/chat.gateway';
import { PresenceService } from '../presence/presence.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatGateway: ChatGateway,
    private readonly presenceService: PresenceService,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    await this.connectToRabbitMQ();
    await this.setupQueues();
    await this.startListening();
  }

  private async connectToRabbitMQ(): Promise<void> {
    try {
      const rabbitmqUrl = this.configService.get('RABBITMQ_URL', 'amqp://localhost:5672');
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      
      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error:', err);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, attempting to reconnect...');
        setTimeout(() => this.connectToRabbitMQ(), 5000);
      });

      this.logger.log('✅ Connected to RabbitMQ successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to RabbitMQ:', error);
      // Retry connection after 5 seconds
      setTimeout(() => this.connectToRabbitMQ(), 5000);
    }
  }

  private async setupQueues(): Promise<void> {
    try {
      // Exchange for chat events
      await this.channel.assertExchange('chat.events', 'topic', { durable: true });
      
      // Queue for websocket service
      const queueName = 'websocket.events';
      await this.channel.assertQueue(queueName, { durable: true });
      
      // Bind queue to relevant routing keys
      const routingKeys = [
        'chat.message.sent',
        'chat.message.updated',
        'chat.message.deleted',
        'chat.message.reaction.added',
        'chat.message.reaction.removed',
        'chat.created',
        'chat.updated',
        'chat.member.added',
        'chat.member.removed',
        'user.status.updated',
        'notification.push',
      ];

      for (const routingKey of routingKeys) {
        await this.channel.bindQueue(queueName, 'chat.events', routingKey);
      }

      this.logger.log(`✅ Queues and bindings set up successfully`);
    } catch (error) {
      this.logger.error('❌ Failed to setup queues:', error);
    }
  }

  private async startListening(): Promise<void> {
    try {
      await this.channel.consume('websocket.events', async (message) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            const routingKey = message.fields.routingKey;
            
            await this.handleEvent(routingKey, content);
            this.channel.ack(message);
            
            this.metricsService.incrementEventsProcessed();
          } catch (error) {
            this.logger.error('Error processing message:', error);
            this.channel.nack(message, false, false); // Don't requeue failed messages
          }
        }
      });

      this.logger.log('🎧 Started listening for events');
    } catch (error) {
      this.logger.error('❌ Failed to start listening:', error);
    }
  }

  private async handleEvent(routingKey: string, data: any): Promise<void> {
    this.logger.debug(`Received event: ${routingKey}`, data);

    switch (routingKey) {
      case 'chat.message.sent':
        await this.handleMessageSent(data);
        break;
      
      case 'chat.message.updated':
        await this.handleMessageUpdated(data);
        break;
      
      case 'chat.message.deleted':
        await this.handleMessageDeleted(data);
        break;
      
      case 'chat.message.reaction.added':
        await this.handleReactionAdded(data);
        break;
      
      case 'chat.message.reaction.removed':
        await this.handleReactionRemoved(data);
        break;
      
      case 'chat.created':
        await this.handleChatCreated(data);
        break;
      
      case 'chat.updated':
        await this.handleChatUpdated(data);
        break;
      
      case 'chat.member.added':
        await this.handleMemberAdded(data);
        break;
      
      case 'chat.member.removed':
        await this.handleMemberRemoved(data);
        break;
      
      case 'user.status.updated':
        await this.handleUserStatusUpdated(data);
        break;
      
      case 'notification.push':
        await this.handlePushNotification(data);
        break;
      
      default:
        this.logger.warn(`Unhandled event type: ${routingKey}`);
    }
  }

  private async handleMessageSent(data: any): Promise<void> {
    const messageData = {
      id: data.messageId,
      chatId: data.chatId,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      type: data.type,
      parentId: data.parentId,
      attachments: data.attachments,
      timestamp: data.createdAt,
      status: 'delivered',
    };

    await this.chatGateway.broadcastMessage(data.chatId, messageData);
  }

  private async handleMessageUpdated(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('message_edited', {
      messageId: data.messageId,
      chatId: data.chatId,
      newContent: data.content,
      editedBy: data.editedBy,
      editedAt: data.updatedAt,
    });
  }

  private async handleMessageDeleted(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('message_deleted', {
      messageId: data.messageId,
      chatId: data.chatId,
      deletedBy: data.deletedBy,
      deletedAt: data.deletedAt,
    });
  }

  private async handleReactionAdded(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('reaction_added', {
      messageId: data.messageId,
      chatId: data.chatId,
      emoji: data.emoji,
      userId: data.userId,
      username: data.username,
      timestamp: data.createdAt,
    });
  }

  private async handleReactionRemoved(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('reaction_removed', {
      messageId: data.messageId,
      chatId: data.chatId,
      emoji: data.emoji,
      userId: data.userId,
      timestamp: data.deletedAt,
    });
  }

  private async handleChatCreated(data: any): Promise<void> {
    // Notify members about new chat
    await this.chatGateway.broadcastChatEvent('chat_created', {
      chatId: data.chatId,
      name: data.name,
      type: data.type,
      createdBy: data.createdBy,
      members: data.members,
      userIds: data.members.map(m => m.userId),
      timestamp: data.createdAt,
    });
  }

  private async handleChatUpdated(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('chat_updated', {
      chatId: data.chatId,
      changes: data.changes,
      updatedBy: data.updatedBy,
      timestamp: data.updatedAt,
    });
  }

  private async handleMemberAdded(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('member_added', {
      chatId: data.chatId,
      member: data.member,
      addedBy: data.addedBy,
      timestamp: data.timestamp,
    });
  }

  private async handleMemberRemoved(data: any): Promise<void> {
    await this.chatGateway.broadcastChatEvent('member_removed', {
      chatId: data.chatId,
      memberId: data.memberId,
      removedBy: data.removedBy,
      timestamp: data.timestamp,
    });
  }

  private async handleUserStatusUpdated(data: any): Promise<void> {
    await this.presenceService.updateUserStatus(data.userId, data.status);
  }

  private async handlePushNotification(data: any): Promise<void> {
    // Check if user is offline before sending push notification
    const isOnline = await this.presenceService.isUserOnline(data.userId);
    
    if (!isOnline && data.shouldPush) {
      // Here you would integrate with your push notification service
      // For now, we'll just log it
      this.logger.log(`📱 Push notification needed for user ${data.userId}: ${data.message}`);
    }
  }
}