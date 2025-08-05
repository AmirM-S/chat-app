import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    
    this.logger.error('WebSocket exception:', {
      socketId: client.id,
      userId: client.data?.user?.sub,
      error: exception.message,
      stack: exception.stack,
    });

    if (exception instanceof WsException) {
      client.emit('error', {
        message: exception.message,
        timestamp: new Date(),
      });
    } else {
      client.emit('error', {
        message: 'Internal server error',
        timestamp: new Date(),
      });
    }
  }
}