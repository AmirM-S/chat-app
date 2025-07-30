import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use Redis adapter for Socket.IO clustering
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Health check
  app.use('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'websocket-service',
      timestamp: new Date().toISOString() 
    });
  });

  await app.listen(3003);
  console.log('🔌 WebSocket Service running on http://localhost:3003');
}
bootstrap();