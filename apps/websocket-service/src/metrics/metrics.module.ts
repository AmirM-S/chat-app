import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {} 