import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { AuthenticatedSocket } from '../auth/interfaces/authenticated-socket.interface';
import { PresenceService } from '../presence/presence.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import {
  SendMessageDto,
  JoinRoomDto,
  LeaveRoomDto,
  TypingDto,
  MessageReactionDto,
} from './dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly presenceService: PresenceService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authentication happens in WsJwtGuard
      this.logger.log(`Client connecting: ${client.id}`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      if (client.user) {
        await this.presenceService.userDisconnected(client.user.userId, client.id);
        
        // Notify rooms about user going offline
        const userRooms = await this.presenceService.getUserRooms(client.user.userId);
        userRooms.forEach(roomId => {
          client.to(roomId).emit('user_status_changed', {
            userId: client.user.userId,
            status: 'offline',
            lastSeen: new Date(),
          });
        });
      }
      
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('authenticate')
  async handleAuthentication(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      // Mark user as online
      await this.presenceService.userConnected(client.user.userId, client.id);
      
      // Join user to their rooms
      const userRooms = await this.presenceService.getUserRooms(client.user.userId);
      userRooms.forEach(roomId => {
        client.join(roomId);
        // Notify room members that user is online
        client.to(roomId).emit('user_status_changed', {
          userId: client.user.userId,
          status: 'online',
          lastSeen: new Date(),
        });
      });

      client.emit('authenticated', {
        success: true,
        userId: client.user.userId,
        rooms: userRooms,
      });

      this.logger.log(`User authenticated: ${client.user.userId}`);
    } catch (error) {
      this.logger.error('Authentication error:', error);
      client.emit('error', { message: 'Authentication failed' });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const messageData = {
        ...data,
        senderId: client.user.userId,
        senderName: client.user.username,
        timestamp: new Date(),
        messageId: this.generateMessageId(),
      };

      // Publish to message queue for persistence
      await this.rabbitMQService.publishMessage('message_queue', {
        action: 'send_message',
        data: messageData,
      });

      // Real-time broadcasting
      if (data.roomId) {
        // Group/Channel message
        this.server.to(data.roomId).emit('new_message', messageData);
      } else if (data.recipientId) {
        // Direct message
        const recipientSockets = await this.presenceService.getUserSockets(data.recipientId);
        recipientSockets.forEach(socketId => {
          this.server.to(socketId).emit('new_message', messageData);
        });
        // Also send to sender
        client.emit('new_message', messageData);
      }

      this.logger.log(`Message sent by ${client.user.userId}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await client.join(data.roomId);
      await this.presenceService.addUserToRoom(client.user.userId, data.roomId);

      // Notify other room members
      client.to(data.roomId).emit('user_joined_room', {
        userId: client.user.userId,
        username: client.user.username,
        roomId: data.roomId,
        timestamp: new Date(),
      });

      client.emit('room_joined', {
        roomId: data.roomId,
        timestamp: new Date(),
      });

      this.logger.log(`User ${client.user.userId} joined room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Join room error:', error);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: LeaveRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await client.leave(data.roomId);
      await this.presenceService.removeUserFromRoom(client.user.userId, data.roomId);

      // Notify other room members
      client.to(data.roomId).emit('user_left_room', {
        userId: client.user.userId,
        username: client.user.username,
        roomId: data.roomId,
        timestamp: new Date(),
      });

      client.emit('room_left', {
        roomId: data.roomId,
        timestamp: new Date(),
      });

      this.logger.log(`User ${client.user.userId} left room ${data.roomId}`);
    } catch (error) {
      this.logger.error('Leave room error:', error);
      client.emit('error', { message: 'Failed to leave room' });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const typingData = {
      userId: client.user.userId,
      username: client.user.username,
      roomId: data.roomId,
      recipientId: data.recipientId,
    };

    if (data.roomId) {
      client.to(data.roomId).emit('user_typing_start', typingData);
    } else if (data.recipientId) {
      const recipientSockets = await this.presenceService.getUserSockets(data.recipientId);
      recipientSockets.forEach(socketId => {
        this.server.to(socketId).emit('user_typing_start', typingData);
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @MessageBody() data: TypingDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const typingData = {
      userId: client.user.userId,
      username: client.user.username,
      roomId: data.roomId,
      recipientId: data.recipientId,
    };

    if (data.roomId) {
      client.to(data.roomId).emit('user_typing_stop', typingData);
    } else if (data.recipientId) {
      const recipientSockets = await this.presenceService.getUserSockets(data.recipientId);
      recipientSockets.forEach(socketId => {
        this.server.to(socketId).emit('user_typing_stop', typingData);
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message_reaction')
  async handleMessageReaction(
    @MessageBody() data: MessageReactionDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const reactionData = {
        ...data,
        userId: client.user.userId,
        username: client.user.username,
        timestamp: new Date(),
      };

      // Publish to message queue for persistence
      await this.rabbitMQService.publishMessage('message_queue', {
        action: 'message_reaction',
        data: reactionData,
      });

      // Broadcast reaction to room or direct message participants
      if (data.roomId) {
        this.server.to(data.roomId).emit('message_reaction_added', reactionData);
      } else {
        // For direct messages, find the other participant
        // This would need additional logic to determine the other participant
      }

      this.logger.log(`Reaction added by ${client.user.userId} to message ${data.messageId}`);
    } catch (error) {
      this.logger.error('Message reaction error:', error);
      client.emit('error', { message: 'Failed to add reaction' });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(
    @MessageBody() data: { roomId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      let onlineUsers;
      if (data.roomId) {
        onlineUsers = await this.presenceService.getRoomOnlineUsers(data.roomId);
      } else {
        onlineUsers = await this.presenceService.getUserContacts(client.user.userId);
      }

      client.emit('online_users', {
        roomId: data.roomId,
        users: onlineUsers,
      });
    } catch (error) {
      this.logger.error('Get online users error:', error);
      client.emit('error', { message: 'Failed to get online users' });
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}