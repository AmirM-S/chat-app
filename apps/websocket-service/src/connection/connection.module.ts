import { Module } from '@nestjs/common';
import { ConnectionManager } from './connection.manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ConnectionManager],
  exports: [ConnectionManager],
})
export class ConnectionModule {} 