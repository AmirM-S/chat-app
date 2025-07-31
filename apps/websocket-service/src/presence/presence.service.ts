import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async userConnected(userId: string, socketId: string): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Add socket to user's socket list
    await redis.sadd(`user:${userId}:sockets`, socketId);
    
    // Set user as online
    await redis.setex(`user:${userId}:status`, 3600, 'online');
    
    // Update last seen
    await redis.setex(`user:${userId}:last_seen`, 86400, new Date().toISOString());
  }

  async userDisconnected(userId: string, socketId: string): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Remove socket from user's socket list
    await redis.srem(`user:${userId}:sockets`, socketId);
    
    // Check if user has other active sockets
    const activeSockets = await redis.scard(`user:${userId}:sockets`);
    
    if (activeSockets === 0) {
      // No active sockets, mark as offline
      await redis.setex(`user:${userId}:status`, 3600, 'offline');
      await redis.setex(`user:${userId}:last_seen`, 86400, new Date().toISOString());
    }
  }

  async getUserSockets(userId: string): Promise<string[]> {
    const redis = this.redisService.getClient();
    return redis.smembers(`user:${userId}:sockets`);
  }

  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Add user to room
    await redis.sadd(`room:${roomId}:users`, userId);
    
    // Add room to user's rooms
    await redis.sadd(`user:${userId}:rooms`, roomId);
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    const redis = this.redisService.getClient();
    
    // Remove user from room
    await redis.srem(`room:${roomId}:users`, userId);
    
    // Remove room from user's rooms
    await redis.srem(`user:${userId}:rooms`, roomId);
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const redis = this.redisService.getClient();
    return redis.smembers(`user:${userId}:rooms`);
  }

  async getRoomOnlineUsers(roomId: string): Promise<Array<{ userId: string; status: string; lastSeen: string }>> {
    const redis = this.redisService.getClient();
    
    const userIds = await redis.smembers(`room:${roomId}:users`);
    const onlineUsers = [];

    for (const userId of userIds) {
      const status = await redis.get(`user:${userId}:status`) || 'offline';
      const lastSeen = await redis.get(`user:${userId}:last_seen`) || new Date().toISOString();
      
      onlineUsers.push({
        userId,
        status,
        lastSeen,
      });
    }

    return onlineUsers;
  }

  async getUserContacts(userId: string): Promise<Array<{ userId: string; status: string; lastSeen: string }>> {
    // This would typically query a database for user's contacts/friends
    // For now, return empty array - implement based on your user relationship logic
    return [];
  }
}