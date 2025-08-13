import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  socketIds: string[];
  activeChat?: string;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly PRESENCE_TTL = 300; // 5 minutes

  constructor(private readonly redisService: RedisService) {}

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    try {
      const presence: UserPresence = {
        userId,
        status: PresenceStatus.ONLINE,
        lastSeen: new Date(),
        socketIds: [socketId],
      };

      // Get existing presence to merge socket IDs
      const existingPresence = await this.getUserPresence(userId);
      if (existingPresence) {
        presence.socketIds = [...new Set([...existingPresence.socketIds, socketId])];
        presence.activeChat = existingPresence.activeChat;
      }

      await this.redisService.hset('user_presence', userId, presence);
      await this.redisService.sadd('online_users', userId);

      // Broadcast presence update
      await this.broadcastPresenceUpdate(userId, presence);

      this.logger.debug(`User ${userId} set to online`);
    } catch (error) {
      this.logger.error(`Failed to set user ${userId} online:`, error);
    }
  }

  async setUserOffline(userId: string, socketId: string): Promise<void> {
    try {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        return;
      }

      // Remove socket ID
      presence.socketIds = presence.socketIds.filter(id => id !== socketId);
      presence.lastSeen = new Date();

      if (presence.socketIds.length === 0) {
        // User is completely offline
        presence.status = PresenceStatus.OFFLINE;
        await this.redisService.srem('online_users', userId);
      }

      await this.redisService.hset('user_presence', userId, presence);

      // Broadcast presence update
      await this.broadcastPresenceUpdate(userId, presence);

      this.logger.debug(`User ${userId} socket ${socketId} set to offline`);
    } catch (error) {
      this.logger.error(`Failed to set user ${userId} offline:`, error);
    }
  }

  async updateUserStatus(userId: string, status: PresenceStatus): Promise<void> {
    try {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        return;
      }

      presence.status = status;
      presence.lastSeen = new Date();

      await this.redisService.hset('user_presence', userId, presence);

      // Broadcast presence update
      await this.broadcastPresenceUpdate(userId, presence);

      this.logger.debug(`User ${userId} status updated to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update user ${userId} status:`, error);
    }
  }

  async setActiveChat(userId: string, chatId: string): Promise<void> {
    try {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        return;
      }

      presence.activeChat = chatId;
      presence.lastSeen = new Date();

      await this.redisService.hset('user_presence', userId, presence);

      this.logger.debug(`User ${userId} active chat set to ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to set active chat for user ${userId}:`, error);
    }
  }

  async clearActiveChat(userId: string): Promise<void> {
    try {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        return;
      }

      delete presence.activeChat;
      presence.lastSeen = new Date();

      await this.redisService.hset('user_presence', userId, presence);

      this.logger.debug(`User ${userId} active chat cleared`);
    } catch (error) {
      this.logger.error(`Failed to clear active chat for user ${userId}:`, error);
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    try {
      const presence = await this.getUserPresence(userId);
      if (!presence) {
        return;
      }

      presence.lastSeen = new Date();
      await this.redisService.hset('user_presence', userId, presence);
    } catch (error) {
      this.logger.error(`Failed to update last seen for user ${userId}:`, error);
    }
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      return await this.redisService.hget<UserPresence>('user_presence', userId);
    } catch (error) {
      this.logger.error(`Failed to get presence for user ${userId}:`, error);
      return null;
    }
  }

  async getMultipleUserPresence(userIds: string[]): Promise<Record<string, UserPresence>> {
    try {
      const presences: Record<string, UserPresence> = {};
      
      for (const userId of userIds) {
        const presence = await this.getUserPresence(userId);
        if (presence) {
          presences[userId] = presence;
        }
      }

      return presences;
    } catch (error) {
      this.logger.error('Failed to get multiple user presence:', error);
      return {};
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      return await this.redisService.smembers('online_users');
    } catch (error) {
      this.logger.error('Failed to get online users:', error);
      return [];
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      return await this.redisService.sismember('online_users', userId);
    } catch (error) {
      this.logger.error(`Failed to check if user ${userId} is online:`, error);
      return false;
    }
  }

  private async broadcastPresenceUpdate(userId: string, presence: UserPresence): Promise<void> {
    try {
      await this.redisService.publish('presence_updates', {
        type: 'presence_update',
        userId,
        presence,
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast presence update for user ${userId}:`, error);
    }
  }
}