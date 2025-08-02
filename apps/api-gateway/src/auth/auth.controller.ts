import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Headers, 
  UseGuards,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiBearerAuth, 
  ApiResponse,
  ApiBody 
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProxyService } from '../proxy/proxy.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto, RegisterDto } from './dto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'POST',
      '/auth/register',
      registerDto
    );
    return response.data;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'POST',
      '/auth/login',
      loginDto
    );
    return response.data;
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'GET',
      '/auth/profile',
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshDto: { refreshToken: string }) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'POST',
      '/auth/refresh',
      refreshDto
    );
    return response.data;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequestWithCircuitBreaker(
      'auth',
      'POST',
      '/auth/logout',
      null,
      { authorization: auth }
    );
    return response.data;
  }
}