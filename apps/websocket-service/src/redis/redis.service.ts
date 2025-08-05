import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  async hset(hash: string, field: string, value: any): Promise<void> {
    try {
      await this.redis.hset(hash, field, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set hash ${hash} field ${field}:`, error);
    }
  }

  async hget<T>(hash: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(hash, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get hash ${hash} field ${field}:`, error);
      return null;
    }
  }

  async hdel(hash: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(hash, field);
    } catch (error) {
      this.logger.error(`Failed to delete hash ${hash} field ${field}:`, error);
    }
  }

  async hgetall<T>(hash: string): Promise<Record<string, T>> {
    try {
      const values = await this.redis.hgetall(hash);
      const result: Record<string, T> = {};
      
      for (const [key, value] of Object.entries(values)) {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value as T;
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get all hash ${hash}:`, error);
      return {};
    }
  }

  async sadd(set: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.sadd(set, ...members);
    } catch (error) {
      this.logger.error(`Failed to add to set ${set}:`, error);
    }
  }

  async srem(set: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.srem(set, ...members);
    } catch (error) {
      this.logger.error(`Failed to remove from set ${set}:`, error);
    }
  }

  async smembers(set: string): Promise<string[]> {
    try {
      return await this.redis.smembers(set);
    } catch (error) {
      this.logger.error(`Failed to get set members ${set}:`, error);
      return [];
    }
  }

  async sismember(set: string, member: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(set, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check set membership ${set}:`, error);
      return false;
    }
  }

  async publish(channel: string, message: any): Promise<void> {
    try {
      await this.redis.publish(channel, JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}:`, error);
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe(channel);
      
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            callback(JSON.parse(message));
          } catch {
            callback(message);
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, error);
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Failed to set expiry for key ${key}:`, error);
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.redis.ping();
    } catch (error) {
      this.logger.error('Failed to ping Redis:', error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.redis;
  }
}