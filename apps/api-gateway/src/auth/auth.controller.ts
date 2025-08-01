import { Controller, Post, Get, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProxyService } from '../proxy/proxy.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.proxyService.forwardRequest(
      'auth',
      'POST',
      '/auth/register',
      registerDto
    );
    return response.data;
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto) {
    const response = await this.proxyService.forwardRequest(
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
  async getProfile(@Headers('authorization') auth: string) {
    const response = await this.proxyService.forwardRequest(
      'auth',
      'GET',
      '/auth/profile',
      null,
      { authorization: auth }
    );
    return response.data;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  async refresh(@Body() refreshDto: { refreshToken: string }) {
    const response = await this.proxyService.forwardRequest(
      'auth',
      'POST',
      '/auth/refresh',
      refreshDto
    );
    return response.data;
  }
}
