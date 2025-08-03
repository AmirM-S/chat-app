import { IsString, IsOptional, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';

export class UpdateChatDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(100)
  participants?: string[];

  @IsOptional()
  settings?: {
    isPublic?: boolean;
    allowInvites?: boolean;
    mutedUntil?: Date;
  };
}