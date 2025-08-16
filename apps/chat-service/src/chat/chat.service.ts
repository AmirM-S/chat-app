import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { ClientProxy } from '@nestjs/microservices';
import {
  Chat,
  ChatDocument,
  ChatType,
  ChatStatus,
} from './schemas/chat.schema';
import {
  Message,
  MessageDocument,
  MessageType,
  MessageStatus,
} from './schemas/message.schema';
import {
  CreateChatDto,
  UpdateChatDto,
  SendMessageDto,
  UpdateMessageDto,
} from './dto';
import { PaginationDto, SearchDto } from '../common/dto';
import { EventsService } from '../events/event.service';
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
  async createChat(
    createChatDto: CreateChatDto,
    userId: string,
  ): Promise<ChatDocument> {
    try {
      const { participants, ...chatData } = createChatDto;

      // Validate participants exist
      const validParticipants = await this.validateParticipants([
        userId,
        ...participants,
      ]);

      const chat = new this.chatModel({
        ...chatData,
        createdBy: userId,
        participants: validParticipants,
        admins: [userId],
        lastActivity: new Date(),
        participantSettings: new Map(
          validParticipants.map((id) => [
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

      console.log('chat', chat);
      const savedChat = await chat.save();

      // Invalidate user's chat list cache
      await this.invalidateUserChatCache(validParticipants);

      // Emit event
      this.eventsService.emitChatCreated(savedChat);

      // Send notifications
      this.notifyParticipants(savedChat._id.toString(), 'chat_created', {
        chatName: savedChat.name,
      });

      this.logger.log(`Chat created: ${savedChat._id} by user: ${userId}`);
      return savedChat;
    } catch (error) {
      this.logger.error(`Failed to create chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserChats(
    userId: string,
    pagination: PaginationDto,
  ): Promise<{
    chats: ChatDocument[];
    total: number;
    hasNext: boolean;
  }> {
    const cacheKey = `user_chats:${userId}:${pagination.page}:${pagination.limit}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<{
        chats: ChatDocument[];
        total: number;
        hasNext: boolean;
      }>(cacheKey);
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
          .exec(),
        this.chatModel.countDocuments({
          participants: userId,
          status: ChatStatus.ACTIVE,
        }),
      ]);

      const result = {
        chats: chats,
        total,
        hasNext: skip + chats.length < total,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get user chats: ${error.message}`,
        error.stack,
      );
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
      const chatDoc = chat as ChatDocument;
      if (!chatDoc.participants.some((p) => p.toString() === userId)) {
        throw new ForbiddenException('Access denied');
      }

      return chat as ChatDocument;
    } catch (error) {
      this.logger.error(`Failed to get chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Message Management
  async sendMessage(
    sendMessageDto: SendMessageDto,
    userId: string,
  ): Promise<MessageDocument> {
    try {
      const {
        chatId,
        content,
        type = MessageType.TEXT,
        replyTo,
        mentions = [],
      } = sendMessageDto;

      // Validate chat and permissions
      const chat = await this.getChatById(chatId, userId);

      // Validate mentions
      const validMentions =
        mentions.length > 0 ? await this.validateParticipants(mentions) : [];

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
        this.invalidateUserChatCache(
          chat.participants.map((id: any) => id.toString()),
        ),
        this.cacheService.delete(`messages:${chatId}:*`),
      ]);

      // Emit real-time event
      this.eventsService.emitMessageSent(savedMessage);

      // Send push notifications
      this.notifyParticipants(
        chatId,
        'new_message',
        {
          messageId: savedMessage._id,
          senderId: userId,
          content: content.substring(0, 100),
        },
        [userId],
      );

      this.logger.log(`Message sent: ${savedMessage._id} in chat: ${chatId}`);
      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to send message: ${error.message}`,
        error.stack,
      );
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
      const cached = await this.cacheService.get<{
        messages: MessageDocument[];
        total: number;
        hasNext: boolean;
      }>(cacheKey);
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
          .exec(),
        this.messageModel.countDocuments({
          chatId,
          status: { $ne: MessageStatus.DELETED },
        }),
      ]);

      const result = {
        messages: messages.reverse(), // Reverse to get chronological order
        total,
        hasNext: skip + messages.length < total,
      };

      // Cache for 2 minutes (shorter TTL for messages)
      await this.cacheService.set(cacheKey, result, 120);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get chat messages: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markMessagesAsRead(
    chatId: string,
    userId: string,
    messageIds?: string[],
  ): Promise<void> {
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
      this.logger.error(
        `Failed to mark messages as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Search functionality
  async searchMessages(
    searchDto: SearchDto,
    userId: string,
  ): Promise<MessageDocument[]> {
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
        .exec();

      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to search messages: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Utility methods
  private async validateParticipants(userIds: string[]): Promise<string[]> {
    // This would typically call the user service to validate user existence
    // For now, return as-is
    return userIds.filter((id) => Types.ObjectId.isValid(id));
  }

  private async getUserAccessibleChats(userId: string): Promise<string[]> {
    const chats = await this.chatModel
      .find({ participants: userId, status: ChatStatus.ACTIVE })
      .select('_id')
      .lean()
      .exec();

    return chats.map((chat) => chat._id.toString());
  }

  private async updateUnreadCounts(
    chatId: string,
    senderId: string,
  ): Promise<void> {
    const chat = await this.chatModel.findById(chatId).lean().exec();
    if (!chat) return;

    const otherParticipants = chat.participants.filter(
      (p) => p.toString() !== senderId,
    );

    const updatePromises = otherParticipants.map((participantId) =>
      this.chatModel.updateOne(
        { _id: chatId },
        { $inc: { [`participantSettings.${participantId}.unreadCount`]: 1 } },
      ),
    );

    await Promise.all(updatePromises);
  }

  private async invalidateUserChatCache(userIds: string[]): Promise<void> {
    const cacheKeys = userIds.flatMap((userId) => [`user_chats:${userId}:*`]);

    await Promise.all(
      cacheKeys.map((pattern) => this.cacheService.deletePattern(pattern)),
    );
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

  async updateChat(
    chatId: string,
    updateChatDto: UpdateChatDto,
    userId: string,
  ): Promise<ChatDocument> {
    try {
      const chat = await this.getChatById(chatId, userId);

      // Check if user has permission to update chat
      if (!this.hasAdminPermission(chat, userId)) {
        throw new ForbiddenException('Insufficient permissions to update chat');
      }

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            ...updateChatDto,
            lastActivity: new Date(),
          },
          { new: true, runValidators: true },
        )
        .exec();

      // Invalidate cache
      await this.cacheService.delete(`chat:${chatId}`);
      await this.invalidateUserChatCache(
        chat.participants.map((id: any) => id.toString()),
      );

      // Emit event
      this.eventsService.emitChatUpdated(updatedChat as ChatDocument);

      this.logger.log(`Chat updated: ${chatId} by user: ${userId}`);
      return updatedChat as ChatDocument;
    } catch (error) {
      this.logger.error(`Failed to update chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    try {
      const chat = await this.getChatById(chatId, userId);

      // Only owner can delete chat
      if (chat.createdBy.toString() !== userId) {
        throw new ForbiddenException('Only chat owner can delete the chat');
      }

      await this.chatModel.findByIdAndUpdate(chatId, {
        status: ChatStatus.DELETED,
        lastActivity: new Date(),
      });

      // Invalidate cache
      await this.cacheService.delete(`chat:${chatId}`);
      await this.invalidateUserChatCache(
        chat.participants.map((id: any) => id.toString()),
      );

      this.logger.log(`Chat deleted: ${chatId} by user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete chat: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addParticipants(
    chatId: string,
    userIds: string[],
    userId: string,
  ): Promise<ChatDocument> {
    try {
      const chat = await this.getChatById(chatId, userId);

      if (!this.hasAdminPermission(chat, userId)) {
        throw new ForbiddenException(
          'Insufficient permissions to add participants',
        );
      }

      const validUserIds = await this.validateParticipants(userIds);
      const newParticipants = validUserIds.filter(
        (id) => !chat.participants.some((p) => p.toString() === id),
      );

      if (newParticipants.length === 0) {
        throw new BadRequestException('No new participants to add');
      }

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            $addToSet: { participants: { $each: newParticipants } },
            lastActivity: new Date(),
          },
          { new: true },
        )
        .exec();

      // Initialize participant settings for new members
      const participantUpdates = {};
      newParticipants.forEach((participantId) => {
        participantUpdates[`participantSettings.${participantId}`] = {
          role: 'member',
          joinedAt: new Date(),
          lastRead: new Date(),
          unreadCount: 0,
        };
      });

      await this.chatModel.updateOne(
        { _id: chatId },
        { $set: participantUpdates },
      );

      // Invalidate cache
      await this.cacheService.delete(`chat:${chatId}`);
      await this.invalidateUserChatCache(
        [...chat.participants, ...newParticipants].map((id: any) =>
          id.toString(),
        ),
      );

      // Emit events
      newParticipants.forEach((participantId) => {
        this.eventsService.emitUserJoinedChat(chatId, participantId);
      });

      this.logger.log(
        `Participants added to chat ${chatId}: ${newParticipants.join(', ')}`,
      );
      return updatedChat as ChatDocument;
    } catch (error) {
      this.logger.error(
        `Failed to add participants: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeParticipant(
    chatId: string,
    participantId: string,
    userId: string,
  ): Promise<ChatDocument> {
    try {
      const chat = await this.getChatById(chatId, userId);

      // Users can remove themselves, or admins can remove others
      if (participantId !== userId && !this.hasAdminPermission(chat, userId)) {
        throw new ForbiddenException(
          'Insufficient permissions to remove participant',
        );
      }

      // Cannot remove chat owner
      if (participantId === chat.createdBy.toString()) {
        throw new ForbiddenException('Cannot remove chat owner');
      }

      const updatedChat = await this.chatModel
        .findByIdAndUpdate(
          chatId,
          {
            $pull: {
              participants: participantId,
              admins: participantId,
            },
            $unset: { [`participantSettings.${participantId}`]: 1 },
            lastActivity: new Date(),
          },
          { new: true },
        )
        .exec();

      // Invalidate cache
      await this.cacheService.delete(`chat:${chatId}`);
      await this.invalidateUserChatCache(
        [...chat.participants].map((id: any) => id.toString()),
      );

      // Emit event
      this.eventsService.emitUserLeftChat(chatId, participantId);

      this.logger.log(
        `Participant ${participantId} removed from chat ${chatId}`,
      );
      return updatedChat as ChatDocument;
    } catch (error) {
      this.logger.error(
        `Failed to remove participant: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateMessage(
    messageId: string,
    updateMessageDto: UpdateMessageDto,
    userId: string,
  ): Promise<MessageDocument> {
    try {
      const message = await this.messageModel.findById(messageId).exec();

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.senderId.toString() !== userId) {
        throw new ForbiddenException('Can only edit your own messages');
      }

      const updatedMessage = await this.messageModel
        .findByIdAndUpdate(
          messageId,
          {
            ...updateMessageDto,
            'metadata.edited': true,
            'metadata.editedAt': new Date(),
            'metadata.originalContent': message.content,
          },
          { new: true, runValidators: true },
        )
        .exec();

      // Invalidate cache
      await this.cacheService.delete(`messages:${message.chatId}:*`);

      // Emit event
      this.eventsService.emitMessageUpdated(updatedMessage as MessageDocument);

      this.logger.log(`Message updated: ${messageId} by user: ${userId}`);
      return updatedMessage as MessageDocument;
    } catch (error) {
      this.logger.error(
        `Failed to update message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.messageModel.findById(messageId).lean().exec();

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Users can delete their own messages, or admins can delete any message
      const chat = await this.getChatById(message.chatId.toString(), userId);
      const canDelete =
        message.senderId.toString() === userId ||
        this.hasAdminPermission(chat, userId);

      if (!canDelete) {
        throw new ForbiddenException(
          'Insufficient permissions to delete message',
        );
      }

      await this.messageModel.findByIdAndUpdate(messageId, {
        status: MessageStatus.DELETED,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      // Invalidate cache
      await this.cacheService.delete(`messages:${message.chatId}:*`);

      this.logger.log(`Message deleted: ${messageId} by user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.messageModel.findById(messageId).lean().exec();

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Verify user has access to the chat
      await this.getChatById(message.chatId.toString(), userId);

      await this.messageModel.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: userId },
        $set: { [`readReceipts.${userId}`]: new Date() },
      });

      // Emit read receipt event
      this.eventsService.emitMessagesRead(message.chatId.toString(), userId, [
        messageId,
      ]);

      this.logger.log(`Message ${messageId} marked as read by ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to mark message as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<MessageDocument> {
    try {
      const message = await this.messageModel.findById(messageId).lean().exec();

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Verify user has access to the chat
      await this.getChatById(message.chatId.toString(), userId);

      const updatedMessage = await this.messageModel
        .findByIdAndUpdate(
          messageId,
          {
            $addToSet: { [`metadata.reactions.${emoji}`]: userId },
          },
          { new: true },
        )
        .exec();

      // Invalidate cache
      await this.cacheService.delete(`messages:${message.chatId}:*`);

      this.logger.log(
        `Reaction ${emoji} added to message ${messageId} by ${userId}`,
      );
      return updatedMessage as MessageDocument;
    } catch (error) {
      this.logger.error(
        `Failed to add reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<MessageDocument> {
    try {
      const message = await this.messageModel.findById(messageId).lean().exec();

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Verify user has access to the chat
      await this.getChatById(message.chatId.toString(), userId);

      const updatedMessage = await this.messageModel
        .findByIdAndUpdate(
          messageId,
          {
            $pull: { [`metadata.reactions.${emoji}`]: userId },
          },
          { new: true },
        )
        .exec();

      // Clean up empty reaction arrays
      if (updatedMessage?.metadata?.reactions?.[emoji]?.length === 0) {
        await this.messageModel.findByIdAndUpdate(messageId, {
          $unset: { [`metadata.reactions.${emoji}`]: 1 },
        });
      }

      // Invalidate cache
      await this.cacheService.delete(`messages:${message.chatId}:*`);

      this.logger.log(
        `Reaction ${emoji} removed from message ${messageId} by ${userId}`,
      );
      return updatedMessage as MessageDocument;
    } catch (error) {
      this.logger.error(
        `Failed to remove reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getChatStatistics(chatId: string, userId: string): Promise<any> {
    try {
      await this.getChatById(chatId, userId);

      const stats = await this.messageModel
        .aggregate([
          {
            $match: {
              chatId: new Types.ObjectId(chatId),
              status: { $ne: MessageStatus.DELETED },
            },
          },
          {
            $group: {
              _id: null,
              totalMessages: { $sum: 1 },
              messagesByType: {
                $push: {
                  type: '$type',
                  senderId: '$senderId',
                  createdAt: '$createdAt',
                },
              },
              messagesByUser: {
                $addToSet: '$senderId',
              },
              firstMessage: { $min: '$createdAt' },
              lastMessage: { $max: '$createdAt' },
            },
          },
          {
            $project: {
              _id: 0,
              totalMessages: 1,
              uniqueUsers: { $size: '$messagesByUser' },
              firstMessage: 1,
              lastMessage: 1,
              messageTypes: {
                $arrayToObject: {
                  $map: {
                    input: { $setUnion: '$messagesByType.type' },
                    as: 'type',
                    in: {
                      k: '$type',
                      v: {
                        $size: {
                          $filter: {
                            input: '$messagesByType',
                            cond: { $eq: ['$this.type', '$type'] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ])
        .exec();

      return (
        stats[0] || {
          totalMessages: 0,
          uniqueUsers: 0,
          messageTypes: {},
          firstMessage: null,
          lastMessage: null,
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to get chat statistics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private hasAdminPermission(chat: ChatDocument, userId: string): boolean {
    return (
      chat.createdBy.toString() === userId ||
      chat.admins.some((admin) => admin.toString() === userId)
    );
  }
}
