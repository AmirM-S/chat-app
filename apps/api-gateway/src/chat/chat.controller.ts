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
  Headers,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth, 
  ApiResponse,
  ApiQuery,
  ApiParam 
} from '@nestjs/swagger';
import { ProxyService } from '../proxy/proxy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  CreateRoomDto, 
  UpdateRoomDto, 
  AddMemberDto, 
  SearchMessagesDto 
} from './dto';

@ApiTags('Chat')
@Controller('api/v1/chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly proxyService: ProxyService) {}

  // ===============================
  // ROOM MANAGEMENT
  // ===============================
  
  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create chat room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room data' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      '/chat/rooms',
      createRoomDto,
      { authorization: auth }
    );
    return response.data;
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Get user rooms' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  async getUserRooms(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      '/chat/rooms',
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room details retrieved' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 403, description: 'Not a member of this room' })
  async getRoomDetails(
    @Param('roomId') roomId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      `/chat/rooms/${roomId}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Put('rooms/:roomId')
  @ApiOperation({ summary: 'Update room details' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateRoom(
    @Param('roomId') roomId: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'PUT',
      `/chat/rooms/${roomId}`,
      updateRoomDto,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('rooms/:roomId/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join chat room' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Joined room successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async joinRoom(
    @Param('roomId') roomId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/rooms/${roomId}/join`,
      {},
      { authorization: auth }
    );
    return response.data;
  }

  @Post('rooms/:roomId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave chat room' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Left room successfully' })
  async leaveRoom(
    @Param('roomId') roomId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/rooms/${roomId}/leave`,
      {},
      { authorization: auth }
    );
    return response.data;
  }

  @Post('rooms/:roomId/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add member to room' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async addMember(
    @Param('roomId') roomId: string,
    @Body() addMemberDto: AddMemberDto,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/rooms/${roomId}/members`,
      addMemberDto,
      { authorization: auth }
    );
    return response.data;
  }

  @Delete('rooms/:roomId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove member from room' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  async removeMember(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'DELETE',
      `/chat/rooms/${roomId}/members/${userId}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  // ===============================
  // MESSAGE MANAGEMENT
  // ===============================

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get room message history' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Messages per page (default: 50)' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      `/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Get('direct/:userId/messages')
  @ApiOperation({ summary: 'Get direct message history' })
  @ApiParam({ name: 'userId', description: 'Other user ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Messages per page (default: 50)' })
  @ApiResponse({ status: 200, description: 'Direct messages retrieved successfully' })
  async getDirectMessages(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      `/chat/direct/${userId}/messages?page=${page}&limit=${limit}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Put('messages/:messageId')
  @ApiOperation({ summary: 'Edit message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 403, description: 'Can only edit your own messages' })
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() updateData: { content: string },
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'PUT',
      `/chat/messages/${messageId}`,
      updateData,
      { authorization: auth }
    );
    return response.data;
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete this message' })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'DELETE',
      `/chat/messages/${messageId}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('messages/:messageId/reactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add reaction to message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 201, description: 'Reaction added successfully' })
  async addReaction(
    @Param('messageId') messageId: string,
    @Body() reactionData: { emoji: string },
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/messages/${messageId}/reactions`,
      { ...reactionData, messageId },
      { authorization: auth }
    );
    return response.data;
  }

  @Delete('messages/:messageId/reactions/:emoji')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove reaction from message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiParam({ name: 'emoji', description: 'Emoji to remove' })
  @ApiResponse({ status: 200, description: 'Reaction removed successfully' })
  async removeReaction(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'DELETE',
      `/chat/messages/${messageId}/reactions/${emoji}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  async markMessageAsRead(
    @Param('messageId') messageId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/messages/${messageId}/read`,
      {},
      { authorization: auth }
    );
    return response.data;
  }

  @Post('rooms/:roomId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all room messages as read' })
  @ApiParam({ name: 'roomId', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'All messages marked as read' })
  async markRoomAsRead(
    @Param('roomId') roomId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'POST',
      `/chat/rooms/${roomId}/read`,
      {},
      { authorization: auth }
    );
    return response.data;
  }

  // ===============================
  // SEARCH & UTILITY
  // ===============================

  @Get('search')
  @ApiOperation({ summary: 'Search messages' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Limit search to specific room' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 20)' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchMessages(
    @Query('q') query: string,
    @Query('roomId') roomId?: string,
    @Query('limit') limit: number = 20,
    @Headers('authorization') auth: string
  ) {
    const searchParams = new URLSearchParams({ q: query, limit: limit.toString() });
    if (roomId) searchParams.append('roomId', roomId);
    
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      `/chat/search?${searchParams.toString()}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread message count' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Get count for specific room' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(
    @Query('roomId') roomId?: string,
    @Headers('authorization') auth: string
  ) {
    const searchParams = roomId ? `?roomId=${roomId}` : '';
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'chat',
      'GET',
      `/chat/unread-count${searchParams}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }
}