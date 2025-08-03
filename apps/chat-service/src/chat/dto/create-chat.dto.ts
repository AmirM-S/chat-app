import { IsString, IsNotEmpty, IsArray, IsOptional, IsEnum, MaxLength, ArrayMaxSize } from 'class-validator';
import { ChatType } from '../schemas/chat.schema';

export class CreateChatDto {
  @IsEnum(ChatType)
  @IsNotEmpty()
  type: ChatType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsArray()
  @ArrayMaxSize(100) // Reasonable limit for group chats
  participants: string[];

  @IsOptional()
  settings?: {
    isPublic?: boolean;
    allowInvites?: boolean;
  };
}