import { Injectable, Logger, Controller } from '@nestjs/common';
import { ChatMessage } from './chat.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventPattern } from '@nestjs/microservices';

@Controller()
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatMessage.name) private chatModel: Model<ChatMessage>,
  ) {}

  @EventPattern('chat-messages')
  async handleMessage(data: any) {
    try {
      this.logger.log('Received message:', JSON.stringify(data));

      // Handle both direct messages and wrapped messages
      const messageData = data.data || data;
      
      const newMessage = new this.chatModel({
        sender: messageData.sender || 'anonymous',
        content: messageData.content || messageData.message,
        room: messageData.room || 'default',
        timestamp: new Date()
      });

      await newMessage.save();
      this.logger.log(`Message saved to MongoDB: ${newMessage._id}`);
      
      return { success: true, messageId: newMessage._id };
    } catch (error) {
      this.logger.error('Failed to process message:', error);
      throw error;
    }
  }
}
