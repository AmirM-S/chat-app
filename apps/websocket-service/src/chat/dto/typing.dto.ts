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

export class TypingStartDto extends TypingDto {
  @IsBoolean()
  isTyping: true;
}

export class TypingStopDto extends TypingDto {
  @IsBoolean()
  isTyping: false;
}

export interface TypingData {
  userId: string;
  username: string;
  chatId: string;
  isTyping: boolean;
  timestamp: Date;
  message?: string;
} 