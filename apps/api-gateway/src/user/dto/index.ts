import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsEmail, 
  MaxLength, 
  IsUrl 
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
    required: false
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Profile avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false
  })
  @IsUrl()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'Bio/status message',
    example: 'Software developer passionate about chat apps',
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;
}
