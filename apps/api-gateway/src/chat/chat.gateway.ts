import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Message } from './message.schema';
import { JwtService } from '@nestjs/jwt';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('ChatGateway');

  constructor(
    @Inject(forwardRef(() => RabbitMQService))
    private readonly rabbitMQService: RabbitMQService,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Server Initialized');
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token, { secret: 'secret123' });
      (client as any).user = payload;

      this.logger.log(
        `Client connected: ${client.id} (user: ${payload.username})`,
      );
    } catch (err) {
      this.logger.warn(`Invalid token for client ${client.id}`);
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:message')
  async handleMessage(@MessageBody() data: any): Promise<void> {
    const user = (data.client as any)?.user;
    
    // Format the message according to the expected schema
    const formattedMessage = {
      sender: user?.username || 'anonymous',
      content: data.message,
      room: data.room || 'default',
      timestamp: new Date()
    };

    console.log('[WS] Incoming message:', formattedMessage);
    await this.rabbitMQService.publishToQueue('chat-messages', formattedMessage);
    
    // Emit the message back to all connected clients
    this.server.emit('chat:message', formattedMessage);
  }
}
// @SubscribeMessage('send_message')
  // async handleMessage(client: Socket, payload: any): Promise<void> {
  //   const user = (client as any).user;

  //   const saved = await this.messageModel.create({
  //     senderId: user.sub,
  //     receiverId: payload.receiverId,
  //     message: payload.message,
  //   });

  //   this.logger.log(`Message saved from ${user.username}`);
  //   this.server.emit('receive_message', saved);
  // }
// }
