import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Email or username is required' })
  emailOrUsername: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
} 