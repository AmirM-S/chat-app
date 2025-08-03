import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { MessageType } from '../schemas/message.schema';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsOptional()
  attachment?: {
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    thumbnail?: string;
  };

  @IsOptional()
  replyTo?: {
    messageId: string;
    senderId: string;
    content: string;
  };

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(20) // Reasonable mention limit
  mentions?: string[];
}
