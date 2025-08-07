import { Module } from '@nestjs/common';
import { ConnectionManager } from './connection.manager';
import { RedisModule } from '../redis/redis.module';
import { PresenceModule } from '../presence/presence.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [RedisModule, PresenceModule, MetricsModule],
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class ConnectionModule {} 