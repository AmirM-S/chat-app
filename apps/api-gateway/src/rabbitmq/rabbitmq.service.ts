import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async onModuleInit() {
    // Wait a bit for RabbitMQ to be fully ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.connectWithRetry();
  }

  private async connectWithRetry(retries = 10, delay = 2000) {
    try {
      this.logger.log('Attempting to connect to RabbitMQ...');
      this.connection = await amqp.connect('amqp://guest:guest@localhost:5673');
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue('chat-messages', { durable: true });
      this.logger.log('Successfully connected to RabbitMQ');
    } catch (err) {
      if (retries > 0) {
        this.logger.warn(`Connection failed (${err.message}), ${retries} retries left...`);
        await new Promise(res => setTimeout(res, delay));
        return this.connectWithRetry(retries - 1, delay);
      }
      this.logger.error('Failed to connect to RabbitMQ:', err);
      throw err;
    }
  }

  async publishToQueue(queue: string, message: any) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
  }
}