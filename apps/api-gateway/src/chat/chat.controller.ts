import { Controller, Get, Post, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProxyService } from '../proxy/proxy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoomDto, SendMessageDto } from './dto';

@ApiTags('Chat')
@Controller('api/v1/chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly proxyService: ProxyService) {}

  // Room management
  @Post('rooms')
  @ApiOperation({ summary: 'Create chat room' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequest(
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
  async getRooms(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequest(
      'chat',
      'GET',
      '/chat/rooms',
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('rooms/:roomId/join')
  @ApiOperation({ summary: 'Join chat room' })
  async joinRoom(
    @Param('roomId') roomId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequest(
      'chat',
      'POST',
      `/chat/rooms/${roomId}/join`,
      {},
      { authorization: auth }
    );
    return response.data;
  }

  // Message management
  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get room message history' })
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequest(
      'chat',
      'GET',
      `/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  // Direct messages
  @Get('direct/:userId')
  @ApiOperation({ summary: 'Get direct message history' })
  async getDirectMessages(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequest(
      'chat',
      'GET',
      `/chat/direct/${userId}?page=${page}&limit=${limit}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  // Search messages
  @Get('search')
  @ApiOperation({ summary: 'Search messages' })
  async searchMessages(
    @Query('q') query: string,
    @Query('roomId') roomId?: string,
    // @Headers('authorization') auth: string
  ) {
    const searchParams = new URLSearchParams({ q: query });
    if (roomId) searchParams.append('roomId', roomId);
    
    const response = await this.proxyService.forwardRequest(
      'chat',
      'GET',
      `/chat/search?${searchParams.toString()}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }
}