import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ConnectionModule } from '../connection/connection.module';
import { PresenceModule } from '../presence/presence.module';
import { MetricsModule } from '../metrics/metrics.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConnectionModule,
    PresenceModule,
    MetricsModule,
    RedisModule,
    AuthModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {} 