import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  UseGuards,
  MessageBody,
  ConnectedSocket,
  UseFilters,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseInterceptors } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { RateLimitGuard } from '../shared/guards/rate-limit.guard';
import { WsExceptionFilter } from '../shared/filters/ws-exception.filter';
import { ConnectionManager } from '../connection/connection.manager';
import { PresenceService } from '../presence/presence.service';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../redis/redis.service';
import {
  SendMessageDto,
  JoinChatDto,
  LeaveChatDto,
  TypingDto,
  MessageReactionDto,
  EditMessageDto,
  DeleteMessageDto,
  MarkAsReadDto,
} from './dto/chat.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@UseFilters(new WsExceptionFilter())
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly presenceService: PresenceService,
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    await this.connectionManager.handleConnection(client);
  }

  async handleDisconnect(client: Socket) {
    await this.connectionManager.handleDisconnection(client);
  }

  @SubscribeMessage('join_chat')
  @UseGuards(RateLimitGuard)
  async handleJoinChat(
    @MessageBody() data: JoinChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      const { chatId } = data;

      // Join the chat room
      await this.connectionManager.joinRoom(client, `chat:${chatId}`);
      
      // Set active chat for presence
      await this.presenceService.setActiveChat(user.sub, chatId);

      // Notify others in the chat
      client.to(`chat:${chatId}`).emit('user_joined_chat', {
        userId: user.sub,
        username: user.username,
        chatId,
        timestamp: new Date(),
      });

      // Send confirmation to client
      client.emit('joined_chat', {
        chatId,
        message: 'Successfully joined chat',
        timestamp: new Date(),
      });

      this.logger.debug(`User ${user.username} joined chat ${chatId}`);
    } catch (error) {
      this.logger.error('Error joining chat:', error);
      client.emit('error', { message: 'Failed to join chat' });
    }
  }

  @SubscribeMessage('leave_chat')
  @UseGuards(RateLimitGuard)
  async handleLeaveChat(
    @MessageBody() data: LeaveChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      const { chatId } = data;

      // Leave the chat room
      await this.connectionManager.leaveRoom(client, `chat:${chatId}`);
      
      // Clear active chat for presence
      await this.presenceService.clearActiveChat(user.sub);

      // Notify others in the chat
      client.to(`chat:${chatId}`).emit('user_left_chat', {
        userId: user.sub,
        username: user.username,
        chatId,
        timestamp: new Date(),
      });

      // Send confirmation to client
      client.emit('left_chat', {
        chatId,
        message: 'Successfully left chat',
        timestamp: new Date(),
      });

      this.logger.debug(`User ${user.username} left chat ${chatId}`);
    } catch (error) {
      this.logger.error('Error leaving chat:', error);
      client.emit('error', { message: 'Failed to leave chat' });
    }
  }

  @SubscribeMessage('send_message')
  @UseGuards(RateLimitGuard)
  async handleSendMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      await this.connectionManager.updateActivity(client);

      // Broadcast message to chat participants
      const messageData = {
        id: data.tempId,
        chatId: data.chatId,
        senderId: user.sub,
        senderName: user.username,
        content: data.content,
        type: data.type || 'text',
        parentId: data.parentId,
        attachments: data.attachments,
        timestamp: new Date(),
        status: 'sent',
      };

      // Send to chat room
      this.server.to(`chat:${data.chatId}`).emit('new_message', messageData);

      // Update metrics
      this.metricsService.incrementMessages();

      this.logger.debug(`Message sent in chat ${data.chatId} by ${user.username}`);
    } catch (error) {
      this.logger.error('Error sending message:', error);
      client.emit('message_error', { 
        tempId: data.tempId,
        message: 'Failed to send message' 
      });
    }
  }

  @SubscribeMessage('edit_message')
  @UseGuards(RateLimitGuard)
  async handleEditMessage(
    @MessageBody() data: EditMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      const editData = {
        messageId: data.messageId,
        chatId: data.chatId,
        newContent: data.content,
        editedBy: user.sub,
        editedAt: new Date(),
      };

      // Broadcast edit to chat participants
      this.server.to(`chat:${data.chatId}`).emit('message_edited', editData);

      this.logger.debug(`Message ${data.messageId} edited by ${user.username}`);
    } catch (error) {
      this.logger.error('Error editing message:', error);
      client.emit('error', { message: 'Failed to edit message' });
    }
  }

  @SubscribeMessage('delete_message')
  @UseGuards(RateLimitGuard)
  async handleDeleteMessage(
    @MessageBody() data: DeleteMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      const deleteData = {
        messageId: data.messageId,
        chatId: data.chatId,
        deletedBy: user.sub,
        deletedAt: new Date(),
      };

      // Broadcast deletion to chat participants
      this.server.to(`chat:${data.chatId}`).emit('message_deleted', deleteData);

      this.logger.debug(`Message ${data.messageId} deleted by ${user.username}`);
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      client.emit('error', { message: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('add_reaction')
  @UseGuards(RateLimitGuard)
  async handleAddReaction(
    @MessageBody() data: MessageReactionDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      const reactionData = {
        messageId: data.messageId,
        chatId: data.chatId,
        emoji: data.emoji,
        userId: user.sub,
        username: user.username,
        timestamp: new Date(),
      };

      // Broadcast reaction to chat participants
      this.server.to(`chat:${data.chatId}`).emit('reaction_added', reactionData);

      this.logger.debug(`Reaction ${data.emoji} added to message ${data.messageId}`);
    } catch (error) {
      this.logger.error('Error adding reaction:', error);
      client.emit('error', { message: 'Failed to add reaction' });
    }
  }

  @SubscribeMessage('remove_reaction')
  @UseGuards(RateLimitGuard)
  async handleRemoveReaction(
    @MessageBody() data: MessageReactionDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      const reactionData = {
        messageId: data.messageId,
        chatId: data.chatId,
        emoji: data.emoji,
        userId: user.sub,
        timestamp: new Date(),
      };

      // Broadcast reaction removal to chat participants
      this.server.to(`chat:${data.chatId}`).emit('reaction_removed', reactionData);

      this.logger.debug(`Reaction ${data.emoji} removed from message ${data.messageId}`);
    } catch (error) {
      this.logger.error('Error removing reaction:', error);
      client.emit('error', { message: 'Failed to remove reaction' });
    }
  }

  @SubscribeMessage('typing_start')
  @UseGuards(RateLimitGuard)
  async handleTypingStart(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      // Store typing status in Redis with TTL
      await this.redisService.set(
        `typing:${data.chatId}:${user.sub}`,
        {
          userId: user.sub,
          username: user.username,
          chatId: data.chatId,
          startedAt: new Date(),
        },
        10 // 10 seconds TTL
      );

      // Broadcast typing indicator
      client.to(`chat:${data.chatId}`).emit('user_typing', {
        userId: user.sub,
        username: user.username,
        chatId: data.chatId,
        isTyping: true,
      });

      this.logger.debug(`User ${user.username} started typing in chat ${data.chatId}`);
    } catch (error) {
      this.logger.error('Error handling typing start:', error);
    }
  }

  @SubscribeMessage('typing_stop')
  @UseGuards(RateLimitGuard)
  async handleTypingStop(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      // Remove typing status from Redis
      await this.redisService.del(`typing:${data.chatId}:${user.sub}`);

      // Broadcast typing stop
      client.to(`chat:${data.chatId}`).emit('user_typing', {
        userId: user.sub,
        username: user.username,
        chatId: data.chatId,
        isTyping: false,
      });

      this.logger.debug(`User ${user.username} stopped typing in chat ${data.chatId}`);
    } catch (error) {
      this.logger.error('Error handling typing stop:', error);
    }
  }

  @SubscribeMessage('mark_as_read')
  @UseGuards(RateLimitGuard)
  async handleMarkAsRead(
    @MessageBody() data: MarkAsReadDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      
      const readData = {
        chatId: data.chatId,
        messageId: data.messageId,
        userId: user.sub,
        readAt: new Date(),
      };

      // Broadcast read receipt to chat participants
      client.to(`chat:${data.chatId}`).emit('message_read', readData);

      this.logger.debug(`Message ${data.messageId} marked as read by ${user.username}`);
    } catch (error) {
      this.logger.error('Error marking message as read:', error);
    }
  }

  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    try {
      const onlineUsers = await this.presenceService.getOnlineUsers();
      const presenceData = await this.presenceService.getMultipleUserPresence(onlineUsers);
      
      client.emit('online_users', {
        users: onlineUsers,
        presence: presenceData,
        count: onlineUsers.length,
      });
    } catch (error) {
      this.logger.error('Error getting online users:', error);
      client.emit('error', { message: 'Failed to get online users' });
    }
  }

  @SubscribeMessage('update_presence')
  async handleUpdatePresence(
    @MessageBody() data: { status: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = client.data.user;
      await this.presenceService.updateUserStatus(user.sub, data.status as any);
      
      client.emit('presence_updated', {
        userId: user.sub,
        status: data.status,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Error updating presence:', error);
      client.emit('error', { message: 'Failed to update presence' });
    }
  }

  // Method to broadcast message from external services (RabbitMQ events)
  async broadcastMessage(chatId: string, messageData: any) {
    this.server.to(`chat:${chatId}`).emit('new_message', messageData);
  }

  // Method to broadcast chat events from external services
  async broadcastChatEvent(eventType: string, data: any) {
    if (data.chatId) {
      this.server.to(`chat:${data.chatId}`).emit(eventType, data);
    }
    
    // Also broadcast to user rooms if needed
    if (data.userIds && Array.isArray(data.userIds)) {
      data.userIds.forEach(userId => {
        this.server.to(`user:${userId}`).emit(eventType, data);
      });
    }
  }

  // Method to get server instance for external use
  getServer(): Server {
    return this.server;
  }
}