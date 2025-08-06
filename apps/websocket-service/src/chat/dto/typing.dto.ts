import { IsString, IsNotEmpty, IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class TypingDto {
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsBoolean()
  isTyping: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

export class TypingStartDto {
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class TypingStopDto {
  @IsUUID()
  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export interface TypingData {
  userId: string;
  username: string;
  chatId: string;
  isTyping: boolean;
  timestamp: Date;
  message?: string;
} 