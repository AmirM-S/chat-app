import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthResponse {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.userService.create(registerDto);

    // TODO: Send email verification email here
    // await this.emailService.sendVerificationEmail(user.email, user.emailVerificationToken);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: user.toSafeObject(),
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(
      loginDto.emailOrUsername,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: user.toSafeObject(),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateUser(
    emailOrUsername: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userService.findByEmailOrUsername(emailOrUsername);

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.userService.validatePassword(
      user,
      password,
    );

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
      });

      const user = await this.userService.findById(payload.sub);

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify stored refresh token
      const isRefreshTokenValid = await this.userService.validatePassword(
        { ...user, password: user.refreshToken } as User,
        refreshToken,
      );

      if (!isRefreshTokenValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update stored refresh token
      await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        user: user.toSafeObject(),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.userService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async verifyEmail(
    token: string,
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.userService.verifyEmail(token);
    return {
      message: 'Email verified successfully',
      user: user.toSafeObject(),
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const resetToken = await this.userService.generatePasswordResetToken(email);

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(email, resetToken);

    return {
      message: 'Password reset email sent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    await this.userService.resetPassword(token, newPassword);
    return {
      message: 'Password reset successfully',
    };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
