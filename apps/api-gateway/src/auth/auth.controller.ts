import { Controller, Post, Body } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  // constructor(private jwtService: JwtService) {}

  // @Post('login')
  // login(@Body() body: any) {
  //   const { username } = body;

  //   // Simulate a user — in real app you'd query DB
  //   const payload = { username, sub: 'user-id-123' };

  //   return {
  //     access_token: this.jwtService.sign(payload),
  //   };
  // }
}
