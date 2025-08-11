import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import { MessagePattern, Payload } from '@nestjs/microservices';
  import { ChatService } from './chat.service';
  import { CreateChatDto, UpdateChatDto, SendMessageDto, UpdateMessageDto } from './dto';
  import { PaginationDto, SearchDto } from '../common/dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { ApiResponse } from '../common/interfaces/api-response.interface';
  
  @Controller('chats')
  @UseGuards(JwtAuthGuard)
  export class ChatController {
    private readonly logger = new Logger(ChatController.name);
  
    constructor(private readonly chatService: ChatService) {}
  
    @Post()
    async createChat(
      @Body() createChatDto: CreateChatDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const chat = await this.chatService.createChat(createChatDto, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.CREATED,
          message: 'Chat created successfully',
          data: chat,
        };
      } catch (error) {
        this.logger.error(`Create chat error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get()
    async getUserChats(
      @Query() pagination: PaginationDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const result = await this.chatService.getUserChats(req.user.sub, pagination);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Chats retrieved successfully',
          data: result,
        };
      } catch (error) {
        this.logger.error(`Get user chats error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get(':id')
    async getChatById(
      @Param('id') id: string,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const chat = await this.chatService.getChatById(id, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Chat retrieved successfully',
          data: chat,
        };
      } catch (error) {
        this.logger.error(`Get chat by ID error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Put(':id')
    async updateChat(
      @Param('id') id: string,
      @Body() updateChatDto: UpdateChatDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const chat = await this.chatService.updateChat(id, updateChatDto, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Chat updated successfully',
          data: chat,
        };
      } catch (error) {
        this.logger.error(`Chat update error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Delete(':id')
    async deleteChat(
      @Param('id') id: string,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        await this.chatService.deleteChat(id, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Chat deleted successfully',
        };
      } catch (error) {
        this.logger.error(`Delete chat error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    // Message endpoints
    @Post('messages')
    async sendMessage(
      @Body() sendMessageDto: SendMessageDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const message = await this.chatService.sendMessage(sendMessageDto, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.CREATED,
          message: 'Message sent successfully',
          data: message,
        };
      } catch (error) {
        this.logger.error(`Send message error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get(':id/messages')
    async getChatMessages(
      @Param('id') chatId: string,
      @Query() pagination: PaginationDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const result = await this.chatService.getChatMessages(chatId, req.user.sub, pagination);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Messages retrieved successfully',
          data: result,
        };
      } catch (error) {
        this.logger.error(`Get chat messages error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Put('messages/:messageId/read')
    async markMessageAsRead(
      @Param('messageId') messageId: string,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        await this.chatService.markMessagesAsRead(messageId, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Message marked as read',
        };
      } catch (error) {
        this.logger.error(`Mark message as read error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Put(':id/messages/read')
    async markAllMessagesAsRead(
      @Param('id') chatId: string,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        await this.chatService.markMessagesAsRead(chatId, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'All messages marked as read',
        };
      } catch (error) {
        this.logger.error(`Mark all messages as read error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    @Get('search/messages')
    async searchMessages(
      @Query() searchDto: SearchDto,
      @Request() req: any,
    ): Promise<ApiResponse> {
      try {
        const messages = await this.chatService.searchMessages(searchDto, req.user.sub);
        return {
          success: true,
          statusCode: HttpStatus.OK,
          message: 'Search completed successfully',
          data: { messages },
        };
      } catch (error) {
        this.logger.error(`Search messages error: ${error.message}`, error.stack);
        throw error;
      }
    }
  
    // Microservice message patterns
    @MessagePattern('chat.create')
    async handleCreateChat(@Payload() data: { createChatDto: CreateChatDto; userId: string }) {
      return this.chatService.createChat(data.createChatDto, data.userId);
    }
  
    @MessagePattern('chat.get_user_chats')
    async handleGetUserChats(@Payload() data: { userId: string; pagination: PaginationDto }) {
      return this.chatService.getUserChats(data.userId, data.pagination);
    }
  
    @MessagePattern('message.send')
    async handleSendMessage(@Payload() data: { sendMessageDto: SendMessageDto; userId: string }) {
      return this.chatService.sendMessage(data.sendMessageDto, data.userId);
    }
  
    @MessagePattern('messages.mark_read')
    async handleMarkMessagesRead(@Payload() data: { chatId: string; userId: string; messageIds?: string[] }) {
      return this.chatService.markMessagesAsRead(data.chatId, data.userId, data.messageIds);
    }
  }