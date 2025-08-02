import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEmail, 
  IsString, 
  IsNotEmpty, 
  MinLength, 
  MaxLength, 
  Matches 
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Username (3-20 characters, alphanumeric)',
    example: 'john_doe'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores'
  })
  username: string;

  @ApiProperty({
    description: 'Password (minimum 6 characters)',
    example: 'securePassword123'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
    required: false
  })
  @IsString()
  @MaxLength(100)
  fullName?: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Email or username',
    example: 'user@example.com'
  })
  @IsString()
  @IsNotEmpty()
  emailOrUsername: string;

  @ApiProperty({
    description: 'User password',
    example: 'securePassword123'
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}