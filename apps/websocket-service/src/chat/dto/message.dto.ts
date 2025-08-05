import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  @IsString()
  replyTo?: string;

  @IsOptional()
  @IsString()
  type?: 'text' | 'image' | 'file' | 'audio' | 'video';
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsUUID()
  @IsNotEmpty()
  chatId: string;
}

export class DeleteMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsUUID()
  @IsNotEmpty()
  chatId: string;
}

export class MessageReactionDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  reaction: string;
}

export class MarkAsReadDto {
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  @IsDateString()
  lastReadAt?: string;
}

export interface MessageData {
  id: string;
  content: string;
  chatId: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  replyTo?: string;
  reactions?: Record<string, string[]>;
  edited?: boolean;
  deleted?: boolean;
} 