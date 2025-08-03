import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  metadata?: {
    edited?: boolean;
    editedAt?: Date;
    originalContent?: string;
    reactions?: Map<string, string[]>;
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: Date;
  };
}