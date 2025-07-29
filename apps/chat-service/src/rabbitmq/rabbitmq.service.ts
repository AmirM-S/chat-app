import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect, Channel, Connection } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private connection: Connection;
  private channel: Channel;

  async onModuleInit() {
    await this.connect();
     console.lot('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!connectedddd')
  }

  async connect() {
    this.connection = await connect('amqp://localhost');
    this.channel = await this.connection.createChannel();
    console.log('[chat-service] Connected to RabbitMQ');
    console.lot('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!connectedddd22222')
  }

  async publishToQueue(queue: string, message: any) {
    await this.channel.assertQueue(queue, { durable: false });
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    console.log(`[chat-service] Published to queue "${queue}":`, message);
  }
}
