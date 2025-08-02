import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum, 
  IsArray, 
  IsBoolean, 
  IsNumber, 
  Min, 
  Max 
} from 'class-validator';

export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
  CHANNEL = 'channel',
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room name',
    example: 'General Discussion'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Room description',
    example: 'A place for general conversations',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    enum: RoomType,
    description: 'Type of room',
    example: RoomType.GROUP
  })
  @IsEnum(RoomType)
  type: RoomType;

  @ApiProperty({
    description: 'List of participant user IDs',
    type: [String],
    required: false,
    example: ['user1', 'user2']
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  participantIds?: string[];

  @ApiProperty({
    description: 'Whether the room is private',
    example: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean = false;

  @ApiProperty({
    description: 'Maximum number of members',
    example: 100,
    required: false
  })
  @IsNumber()
  @Min(2)
  @Max(1000)
  @IsOptional()
  maxMembers?: number = 100;
}

export class UpdateRoomDto {
  @ApiProperty({
    description: 'Room name',
    required: false
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Room description',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Room avatar URL',
    required: false
  })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'Allow members to invite others',
    required: false
  })
  @IsBoolean()
  @IsOptional()
  allowInvites?: boolean;

  @ApiProperty({
    description: 'Allow file sharing in room',
    required: false
  })
  @IsBoolean()
  @IsOptional()
  allowFileSharing?: boolean;

  @ApiProperty({
    description: 'Maximum number of members',
    required: false
  })
  @IsNumber()
  @Min(2)
  @Max(1000)
  @IsOptional()
  maxMembers?: number;
}

export class AddMemberDto {
  @ApiProperty({
    description: 'User ID to add',
    example: 'user123'
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe'
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    enum: UserRole,
    description: 'Role in the room',
    example: UserRole.MEMBER,
    required: false
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.MEMBER;
}

export class SearchMessagesDto {
  @ApiProperty({
    description: 'Search query',
    example: 'hello world'
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiProperty({
    description: 'Room ID to search in',
    required: false
  })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiProperty({
    description: 'Maximum number of results',
    example: 20,
    required: false
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}