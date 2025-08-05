import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { PresenceService } from '../presence/presence.service';
import { MetricsService } from '../metrics/metrics.service';

export interface SocketData {
  userId: string;
  username: string;
  email: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
}

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private readonly connections = new Map<string, SocketData>();

  constructor(
    private readonly redisService: RedisService,
    private readonly presenceService: PresenceService,
    private readonly metricsService: MetricsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = client.data.user;
      if (!user) {
        this.logger.warn(`Connection rejected - no user data: ${client.id}`);
        client.disconnect();
        return;
      }

      const socketData: SocketData = {
        userId: user.sub,
        username: user.username,
        email: user.email,
        connectedAt: new Date(),
        lastActivity: new Date(),
        rooms: [],
      };

      // Store connection data
      this.connections.set(client.id, socketData);
      
      // Store in Redis for scaling
      await this.redisService.hset(
        'socket_connections',
        client.id,
        socketData,
      );

      // Update user presence
      await this.presenceService.setUserOnline(user.sub, client.id);

      // Update metrics
      this.metricsService.incrementConnections();

      // Join user to their personal room
      await client.join(`user:${user.sub}`);

      this.logger.log(`✅ User connected: ${user.username} (${client.id})`);

      // Send connection confirmation
      client.emit('connected', {
        socketId: client.id,
        userId: user.sub,
        message: 'Connected successfully',
      });

    } catch (error) {
      this.logger.error(`Connection error for ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnection(client: Socket): Promise<void> {
    try {
      const socketData = this.connections.get(client.id);
      if (!socketData) {
        return;
      }

      // Remove from local connections
      this.connections.delete(client.id);

      // Remove from Redis
      await this.redisService.hdel('socket_connections', client.id);

      // Update user presence
      await this.presenceService.setUserOffline(socketData.userId, client.id);

      // Update metrics
      this.metricsService.decrementConnections();

      this.logger.log(`👋 User disconnected: ${socketData.username} (${client.id})`);

    } catch (error) {
      this.logger.error(`Disconnection error for ${client.id}:`, error);
    }
  }

  async updateActivity(client: Socket): Promise<void> {
    const socketData = this.connections.get(client.id);
    if (socketData) {
      socketData.lastActivity = new Date();
      
      // Update in Redis
      await this.redisService.hset(
        'socket_connections',
        client.id,
        socketData,
      );

      // Update presence
      await this.presenceService.updateLastSeen(socketData.userId);
    }
  }

  async joinRoom(client: Socket, roomId: string): Promise<void> {
    try {
      await client.join(roomId);
      
      const socketData = this.connections.get(client.id);
      if (socketData) {
        socketData.rooms.push(roomId);
        await this.redisService.hset(
          'socket_connections',
          client.id,
          socketData,
        );
      }

      this.logger.debug(`User ${client.id} joined room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to join room ${roomId}:`, error);
    }
  }

  async leaveRoom(client: Socket, roomId: string): Promise<void> {
    try {
      await client.leave(roomId);
      
      const socketData = this.connections.get(client.id);
      if (socketData) {
        socketData.rooms = socketData.rooms.filter(room => room !== roomId);
        await this.redisService.hset(
          'socket_connections',
          client.id,
          socketData,
        );
      }

      this.logger.debug(`User ${client.id} left room: ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to leave room ${roomId}:`, error);
    }
  }

  getConnection(socketId: string): SocketData | undefined {
    return this.connections.get(socketId);
  }

  getConnectionsByUserId(userId: string): SocketData[] {
    return Array.from(this.connections.values()).filter(
      connection => connection.userId === userId,
    );
  }

  getTotalConnections(): number {
    return this.connections.size;
  }

  async getConnectionsInRoom(roomId: string): Promise<string[]> {
    try {
      const connections = await this.redisService.smembers(`room:${roomId}`);
      return connections;
    } catch (error) {
      this.logger.error(`Failed to get connections in room ${roomId}:`, error);
      return [];
    }
  }
}