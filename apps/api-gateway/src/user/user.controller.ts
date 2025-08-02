import { 
  Controller, 
  Get, 
  Put, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Headers 
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
import { UpdateProfileDto } from './dto';

@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getCurrentUser(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'GET',
      '/users/me',
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid profile data' })
  async updateCurrentUser(
    @Body() updateProfileDto: UpdateProfileDto,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'PUT',
      '/users/me',
      updateProfileDto,
      { authorization: auth }
    );
    return response.data;
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', description: 'Search query (username or email)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async searchUsers(
    @Query('q') query: string,
    @Query('limit') limit: number = 10,
    @Headers('authorization') auth: string
  ) {
    const searchParams = new URLSearchParams({ q: query, limit: limit.toString() });
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'GET',
      `/users/search?${searchParams.toString()}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(
    @Param('userId') userId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'GET',
      `/users/${userId}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Get(':userId/status')
  @ApiOperation({ summary: 'Get user online status' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  async getUserStatus(
    @Param('userId') userId: string,
    @Headers('authorization') auth: string
  ) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'websocket',
      'GET',
      `/presence/${userId}`,
      null,
      { authorization: auth }
    );
    return response.data;
  }
}