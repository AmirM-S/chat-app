import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { ConnectionModule } from '../connection/connection.module';

@Module({
  imports: [RedisModule, ConnectionModule],
  controllers: [HealthController],
})
export class HealthModule {} 