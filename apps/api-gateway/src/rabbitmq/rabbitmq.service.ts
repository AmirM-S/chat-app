import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ChatGateway } from 'src/chat/chat.gateway';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private chatGateway: ChatGateway;

  async onModuleInit() {
    // Wait a bit for RabbitMQ to be fully ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.connectWithRetry();
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!connectedddd33333')
    await this.consumeBroadcastMessages();  
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
    
    const messageToSend = {
      pattern: 'chat-messages',
      data: message
    };
    
    this.logger.debug(`Publishing message to queue ${queue}:`, messageToSend);
    
    this.channel.sendToQueue(
      queue, 
      Buffer.from(JSON.stringify(messageToSend)), 
      { 
        persistent: true,
        contentType: 'application/json',
        type: 'chat-messages'
      }
    );
  }
  async consumeBroadcastMessages() {
    await this.channel.assertQueue('chat-broadcast', { durable: false });
  
    this.channel.consume('chat-broadcast', (msg) => {
      if (msg !== null) {
        const message = JSON.parse(msg.content.toString());
        console.log('[Broadcast Consumer] Received:', message);
  
        // Emit to all WebSocket clients
        this.chatGateway.server.emit('new_message', message);
  
        this.channel.ack(msg);
      }
    });
  }
}