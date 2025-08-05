import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const user = client.data.user;
    
    if (!user) {
      throw new WsException('User not authenticated');
    }

    const key = `rate_limit:${user.sub}:${Date.now()}`;
    const windowMs = 60000; // 1 minute
    const maxRequests = 60; // 60 requests per minute

    try {
      // Get current count
      const current = await this.redisService.get<number>(key) || 0;
      
      if (current >= maxRequests) {
        this.logger.warn(`Rate limit exceeded for user ${user.sub}`);
        throw new WsException('Rate limit exceeded');
      }

      // Increment counter
      await this.redisService.set(key, current + 1, Math.ceil(windowMs / 1000));
      
      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      
      this.logger.error('Rate limiting error:', error);
      return true; // Allow request if Redis is down
    }
  }
}