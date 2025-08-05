import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisService } from '../redis/redis.service';
import { ConnectionManager } from '../connection/connection.manager';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly connectionManager: ConnectionManager,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Service is healthy' })
  async healthCheck() {
    const redisHealth = await this.checkRedisHealth();
    const connectionHealth = await this.checkConnectionHealth();

    const isHealthy = redisHealth.status === 'ok' && connectionHealth.status === 'ok';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'websocket-service',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        redis: redisHealth,
        connections: connectionHealth,
      },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Service is ready' })
  async readinessCheck() {
    const redisReady = await this.checkRedisHealth();
    
    return {
      status: redisReady.status === 'ok' ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        redis: redisReady,
      },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check endpoint' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Service is alive' })
  async livenessCheck() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkRedisHealth() {
    try {
      const startTime = Date.now();
      await this.redisService.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkConnectionHealth() {
    try {
      const stats = await this.connectionManager.getConnectionStats();
      
      return {
        status: 'ok',
        activeConnections: stats.totalConnections,
        activeUsers: stats.activeUsers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
} 