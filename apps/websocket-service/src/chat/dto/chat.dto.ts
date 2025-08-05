import { IsString, IsOptional, IsArray, IsEnum, IsUUID, IsNotEmpty, IsObject } from 'class-validator';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  VOICE = 'voice',
  VIDEO = 'video',
  LOCATION = 'location',
  SYSTEM = 'system',
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  tempId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  parentId?: string; // For threading

  @IsArray()
  @IsOptional()
  attachments?: any[];

  @IsArray()
  @IsOptional()
  mentions?: string[];
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class DeleteMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class JoinChatDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class LeaveChatDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class TypingDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;
}

export class MessageReactionDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class MarkAsReadDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class PresenceUpdateDto {
  @IsEnum(['online', 'away', 'busy', 'offline'])
  status: string;
}