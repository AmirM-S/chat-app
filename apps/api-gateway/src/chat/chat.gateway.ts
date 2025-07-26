// import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

// @WebSocketGateway()
// export class ChatGateway {
//   @SubscribeMessage('message')
//   handleMessage(client: any, payload: any): string {
//     return 'Hello world!';
//   }
// }

// src/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Message } from './message.schema';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger = new Logger('ChatGateway');

  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Server Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(client: Socket, payload: any): Promise<void> {
    const saved = await this.messageModel.create({
      senderId: payload.senderId,
      receiverId: payload.receiverId,
      message: payload.message,
    });

    this.logger.log(`Message saved: ${saved._id}`);
    this.server.emit('receive_message', saved);
  }
}
