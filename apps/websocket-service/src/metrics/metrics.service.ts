import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface MetricsData {
  totalConnections: number;
  activeUsers: number;
  totalMessages: number;
  messagesPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  peakConnections: number;
  lastUpdated: Date;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeUsers: number;
  peakConnections: number;
  averageConnectionsPerMinute: number;
}

export interface MessageMetrics {
  totalMessages: number;
  messagesPerMinute: number;
  messagesPerHour: number;
  averageMessageLength: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly redisService: RedisService) {}

  async incrementConnection(): Promise<void> {
    try {
      const key = 'metrics:connections:total';
      await this.redisService.incr(key);
      
      // Track peak connections
      const currentTotal = await this.redisService.get<number>(key) || 0;
      const peakKey = 'metrics:connections:peak';
      const currentPeak = await this.redisService.get<number>(peakKey) || 0;
      
      if (currentTotal > currentPeak) {
        await this.redisService.set(peakKey, currentTotal);
      }

      // Track connections per minute
      const minuteKey = `metrics:connections:minute:${this.getCurrentMinute()}`;
      await this.redisService.incr(minuteKey);
      await this.redisService.expire(minuteKey, 120); // Expire after 2 minutes
    } catch (error) {
      this.logger.error('Error incrementing connection metrics:', error);
    }
  }

  async decrementConnection(): Promise<void> {
    try {
      const key = 'metrics:connections:total';
      const current = await this.redisService.get<number>(key) || 0;
      if (current > 0) {
        await this.redisService.set(key, current - 1);
      }
    } catch (error) {
      this.logger.error('Error decrementing connection metrics:', error);
    }
  }

  async incrementMessage(chatId: string, messageLength: number): Promise<void> {
    try {
      // Total messages
      const totalKey = 'metrics:messages:total';
      await this.redisService.incr(totalKey);

      // Messages per minute
      const minuteKey = `metrics:messages:minute:${this.getCurrentMinute()}`;
      await this.redisService.incr(minuteKey);
      await this.redisService.expire(minuteKey, 120);

      // Messages per hour
      const hourKey = `metrics:messages:hour:${this.getCurrentHour()}`;
      await this.redisService.incr(hourKey);
      await this.redisService.expire(hourKey, 7200); // 2 hours

      // Track message lengths for average
      const lengthKey = 'metrics:messages:lengths';
      await this.redisService.sadd(lengthKey, messageLength.toString());
      await this.redisService.expire(lengthKey, 3600); // 1 hour

      // Chat-specific metrics
      const chatKey = `metrics:chat:${chatId}:messages`;
      await this.redisService.incr(chatKey);
    } catch (error) {
      this.logger.error('Error incrementing message metrics:', error);
    }
  }

  async recordResponseTime(responseTime: number): Promise<void> {
    try {
      const key = 'metrics:response:times';
      await this.redisService.sadd(key, responseTime.toString());
      await this.redisService.expire(key, 3600); // 1 hour
    } catch (error) {
      this.logger.error('Error recording response time:', error);
    }
  }

  async recordError(errorType: string): Promise<void> {
    try {
      const key = `metrics:errors:${errorType}`;
      await this.redisService.incr(key);
      await this.redisService.expire(key, 3600); // 1 hour
    } catch (error) {
      this.logger.error('Error recording error metrics:', error);
    }
  }

  async getMetrics(): Promise<MetricsData> {
    try {
      const [
        totalConnections,
        activeUsers,
        totalMessages,
        peakConnections,
        messagesPerMinute,
        averageResponseTime,
        errorRate,
      ] = await Promise.all([
        this.redisService.get<number>('metrics:connections:total') || 0,
        this.redisService.get<number>('metrics:connections:active') || 0,
        this.redisService.get<number>('metrics:messages:total') || 0,
        this.redisService.get<number>('metrics:connections:peak') || 0,
        this.getMessagesPerMinute(),
        this.getAverageResponseTime(),
        this.getErrorRate(),
      ]);

      return {
        totalConnections,
        activeUsers,
        totalMessages,
        messagesPerMinute,
        averageResponseTime,
        errorRate,
        peakConnections,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting metrics:', error);
      return {
        totalConnections: 0,
        activeUsers: 0,
        totalMessages: 0,
        messagesPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        peakConnections: 0,
        lastUpdated: new Date(),
      };
    }
  }

  async getConnectionMetrics(): Promise<ConnectionMetrics> {
    try {
      const [
        totalConnections,
        activeUsers,
        peakConnections,
      ] = await Promise.all([
        this.redisService.get<number>('metrics:connections:total') || 0,
        this.redisService.get<number>('metrics:connections:active') || 0,
        this.redisService.get<number>('metrics:connections:peak') || 0,
      ]);

      const averageConnectionsPerMinute = await this.getAverageConnectionsPerMinute();

      return {
        totalConnections,
        activeUsers,
        peakConnections,
        averageConnectionsPerMinute,
      };
    } catch (error) {
      this.logger.error('Error getting connection metrics:', error);
      return {
        totalConnections: 0,
        activeUsers: 0,
        peakConnections: 0,
        averageConnectionsPerMinute: 0,
      };
    }
  }

  async getMessageMetrics(): Promise<MessageMetrics> {
    try {
      const [
        totalMessages,
        messagesPerMinute,
        messagesPerHour,
      ] = await Promise.all([
        this.redisService.get<number>('metrics:messages:total') || 0,
        this.getMessagesPerMinute(),
        this.getMessagesPerHour(),
      ]);

      const averageMessageLength = await this.getAverageMessageLength();

      return {
        totalMessages,
        messagesPerMinute,
        messagesPerHour,
        averageMessageLength,
      };
    } catch (error) {
      this.logger.error('Error getting message metrics:', error);
      return {
        totalMessages: 0,
        messagesPerMinute: 0,
        messagesPerHour: 0,
        averageMessageLength: 0,
      };
    }
  }

  private async getMessagesPerMinute(): Promise<number> {
    try {
      const key = `metrics:messages:minute:${this.getCurrentMinute()}`;
      return await this.redisService.get<number>(key) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getMessagesPerHour(): Promise<number> {
    try {
      const key = `metrics:messages:hour:${this.getCurrentHour()}`;
      return await this.redisService.get<number>(key) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    try {
      const key = 'metrics:response:times';
      const times = await this.redisService.smembers(key);
      if (times.length === 0) return 0;
      
      const sum = times.reduce((acc, time) => acc + parseInt(time), 0);
      return sum / times.length;
    } catch (error) {
      return 0;
    }
  }

  private async getAverageMessageLength(): Promise<number> {
    try {
      const key = 'metrics:messages:lengths';
      const lengths = await this.redisService.smembers(key);
      if (lengths.length === 0) return 0;
      
      const sum = lengths.reduce((acc, length) => acc + parseInt(length), 0);
      return sum / lengths.length;
    } catch (error) {
      return 0;
    }
  }

  private async getAverageConnectionsPerMinute(): Promise<number> {
    try {
      const key = `metrics:connections:minute:${this.getCurrentMinute()}`;
      return await this.redisService.get<number>(key) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getErrorRate(): Promise<number> {
    try {
      const totalErrors = await this.redisService.get<number>('metrics:errors:total') || 0;
      const totalRequests = await this.redisService.get<number>('metrics:requests:total') || 1;
      return (totalErrors / totalRequests) * 100;
    } catch (error) {
      return 0;
    }
  }

  private getCurrentMinute(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private getCurrentHour(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
  }
} 