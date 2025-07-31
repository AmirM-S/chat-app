import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  recipientId?: string;

  @IsString()
  @IsOptional()
  replyTo?: string;

  @IsString()
  @IsOptional()
  messageType?: 'text' | 'image' | 'file' | 'voice';
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class LeaveRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

export class TypingDto {
  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  recipientId?: string;
}

export class MessageReactionDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;

  @IsString()
  @IsOptional()
  roomId?: string;
}