import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ClientProxy, Inject } from '@nestjs/microservices';
import { Chat, ChatDocument, ChatType, ChatStatus } from './schemas/chat.schema';
import { Message, MessageDocument, MessageType, MessageStatus } from './schemas/message.schema';
import { CreateChatDto, UpdateChatDto, SendMessageDto, UpdateMessageDto } from './dto';
import { PaginationDto, SearchDto } from '../common/dto';
import { EventsService } from '../events/events.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectRedis() private readonly redis: Redis,
    @Inject('NOTIFICATION_SERVICE') private notificationClient: ClientProxy,
    @Inject('USER_SERVICE') private userClient: ClientProxy,
    private eventsService: EventsService,
    private cacheService: CacheService,
  ) {}

  // Chat Management
  async createChat(createChatDto: CreateChatDto, userId: string): Promise<ChatDocument> {
    try {
      const { participants, ...chatData } = createChatDto;
      
      // Validate participants exist
      const validParticipants = await this.validateParticipants([userId, ...participants]);
      
      const chat = new this.chatModel({
        ...chatData,
        createdBy: userId,
        participants: validParticipants,
        admins: [userId],
        lastActivity: new Date(),
        participantSettings: new Map(
          validParticipants.map(id => [
            id,
            {
              role: id === userId ? 'owner' : 'member',
              joinedAt: new Date(),
              lastRead: new Date(),
              unreadCount: 0,
            },
          ]),
        ),
      });

      const savedChat = await chat.save();
      
      // Invalidate user's chat list cache
      await this.invalidateUserChatCache(validParticipants);
      
      // Emit event
      this.eventsService.emitChatCreated(savedChat);
      
      // Send notifications
      this.notifyParticipants(savedChat._id, 'chat_created', { chatName: savedChat.name });
      
      this.logger.log(`Chat created: ${savedChat._id} by user: ${userId}`);
      return savedChat;
    } catch (error) {
      this.logger.error(`Failed to create chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserChats(userId: string, pagination: PaginationDto): Promise<{
    chats: ChatDocument[];
    total: number;
    hasNext: boolean;
  }> {
    const cacheKey = `user_chats:${userId}:${pagination.page}:${pagination.limit}`;
    
    try {
      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      const [chats, total] = await Promise.all([
        this.chatModel
          .find({
            participants: userId,
            status: ChatStatus.ACTIVE,
          })
          .sort({ lastActivity: -1 })
          .skip(skip)
          .limit(limit)
          .populate('lastMessage', 'content type createdAt senderId')
          .lean()
          .exec(),
        this.chatModel.countDocuments({
          participants: userId,
          status: ChatStatus.ACTIVE,
        }),
      ]);

      const result = {
        chats: chats as ChatDocument[],
        total,
        hasNext: skip + chats.length < total,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get user chats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getChatById(chatId: string, userId: string): Promise<ChatDocument> {
    const cacheKey = `chat:${chatId}`;
    
    try {
      // Try cache first
      let chat = await this.cacheService.get(cacheKey);
      
      if (!chat) {
        chat = await this.chatModel
          .findOne({ _id: chatId, status: ChatStatus.ACTIVE })
          .populate('participants', 'username avatar lastSeen')
          .lean()
          .exec();
        
        if (chat) {
          await this.cacheService.set(cacheKey, chat, this.CACHE_TTL);
        }
      }

      if (!chat) {
        throw new NotFoundException('Chat not found');
      }

      // Check if user is participant
      if (!chat.participants.some(p => p.toString() === userId)) {
        throw new ForbiddenException('Access denied');
      }

      return chat as ChatDocument;
    } catch (error) {
      this.logger.error(`Failed to get chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Message Management
  async sendMessage(sendMessageDto: SendMessageDto, userId: string): Promise<MessageDocument> {
    try {
      const { chatId, content, type = MessageType.TEXT, replyTo, mentions = [] } = sendMessageDto;
      
      // Validate chat and permissions
      const chat = await this.getChatById(chatId, userId);
      
      // Validate mentions
      const validMentions = mentions.length > 0 ? await this.validateParticipants(mentions) : [];
      
      const message = new this.messageModel({
        chatId,
        senderId: userId,
        content,
        type,
        replyTo,
        mentions: validMentions,
        readBy: [userId],
        readReceipts: new Map([[userId, new Date()]]),
      });

      const savedMessage = await message.save();
      
      // Update chat's last message and activity
      await this.chatModel.findByIdAndUpdate(chatId, {
        lastMessage: savedMessage._id,
        lastActivity: new Date(),
        $inc: { messageCount: 1 },
      });
      
      // Update unread counts for other participants
      await this.updateUnreadCounts(chatId, userId);
      
      // Invalidate caches
      await Promise.all([
        this.cacheService.delete(`chat:${chatId}`),
        this.invalidateUserChatCache(chat.participants),
        this.cacheService.delete(`messages:${chatId}:*`),
      ]);
      
      // Emit real-time event
      this.eventsService.emitMessageSent(savedMessage);
      
      // Send push notifications
      this.notifyParticipants(chatId, 'new_message', {
        messageId: savedMessage._id,
        senderId: userId,
        content: content.substring(0, 100),
      }, [userId]);
      
      this.logger.log(`Message sent: ${savedMessage._id} in chat: ${chatId}`);
      return savedMessage;
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getChatMessages(
    chatId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<{
    messages: MessageDocument[];
    total: number;
    hasNext: boolean;
  }> {
    try {
      // Verify user access
      await this.getChatById(chatId, userId);
      
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;
      const cacheKey = `messages:${chatId}:${page}:${limit}`;
      
      // Try cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const [messages, total] = await Promise.all([
        this.messageModel
          .find({
            chatId,
            status: { $ne: MessageStatus.DELETED },
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('senderId', 'username avatar')
          .populate('replyTo.senderId', 'username avatar')
          .lean()
          .exec(),
        this.messageModel.countDocuments({
          chatId,
          status: { $ne: MessageStatus.DELETED },
        }),
      ]);

      const result = {
        messages: messages.reverse() as MessageDocument[], // Reverse to get chronological order
        total,
        hasNext: skip + messages.length < total,
      };

      // Cache for 2 minutes (shorter TTL for messages)
      await this.cacheService.set(cacheKey, result, 120);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get chat messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markMessagesAsRead(chatId: string, userId: string, messageIds?: string[]): Promise<void> {
    try {
      const query: any = { chatId, readBy: { $ne: userId } };
      
      if (messageIds && messageIds.length > 0) {
        query._id = { $in: messageIds };
      }

      await this.messageModel.updateMany(query, {
        $addToSet: { readBy: userId },
        $set: { [`readReceipts.${userId}`]: new Date() },
      });

      // Reset unread count for user
      await this.chatModel.updateOne(
        { _id: chatId },
        { $set: { [`participantSettings.${userId}.unreadCount`]: 0 } },
      );

      // Emit read receipt event
      this.eventsService.emitMessagesRead(chatId, userId, messageIds);
      
      // Invalidate cache
      await this.cacheService.delete(`chat:${chatId}`);
      
      this.logger.log(`Messages marked as read by ${userId} in chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Failed to mark messages as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Search functionality
  async searchMessages(searchDto: SearchDto, userId: string): Promise<MessageDocument[]> {
    try {
      const { query, chatId, limit = 20 } = searchDto;
      
      // Get user's accessible chats
      const userChats = chatId 
        ? [chatId] 
        : await this.getUserAccessibleChats(userId);

      const messages = await this.messageModel
        .find({
          chatId: { $in: userChats },
          $text: { $search: query },
          status: { $ne: MessageStatus.DELETED },
        })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit)
        .populate('chatId', 'name type')
        .populate('senderId', 'username avatar')
        .lean()
        .exec();

      return messages as MessageDocument[];
    } catch (error) {
      this.logger.error(`Failed to search messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Utility methods
  private async validateParticipants(userIds: string[]): Promise<string[]> {
    // This would typically call the user service to validate user existence
    // For now, return as-is
    return userIds.filter(id => Types.ObjectId.isValid(id));
  }

  private async getUserAccessibleChats(userId: string): Promise<string[]> {
    const chats = await this.chatModel
      .find({ participants: userId, status: ChatStatus.ACTIVE })
      .select('_id')
      .lean()
      .exec();
    
    return chats.map(chat => chat._id.toString());
  }

  private async updateUnreadCounts(chatId: string, senderId: string): Promise<void> {
    const chat = await this.chatModel.findById(chatId).lean().exec();
    if (!chat) return;

    const otherParticipants = chat.participants.filter(p => p.toString() !== senderId);
    
    const updatePromises = otherParticipants.map(participantId =>
      this.chatModel.updateOne(
        { _id: chatId },
        { $inc: { [`participantSettings.${participantId}.unreadCount`]: 1 } },
      ),
    );

    await Promise.all(updatePromises);
  }

  private async invalidateUserChatCache(userIds: string[]): Promise<void> {
    const cacheKeys = userIds.flatMap(userId => [
      `user_chats:${userId}:*`,
    ]);
    
    await Promise.all(cacheKeys.map(pattern => this.cacheService.deletePattern(pattern)));
  }

  private notifyParticipants(
    chatId: string,
    event: string,
    data: any,
    excludeUsers: string[] = [],
  ): void {
    this.notificationClient.emit('send_notification', {
      chatId,
      event,
      data,
      excludeUsers,
    });
  }
}