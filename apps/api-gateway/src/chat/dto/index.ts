import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
  CHANNEL = 'channel',
}

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: RoomType })
  @IsEnum(RoomType)
  type: RoomType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  participants?: string[];
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  recipientId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  replyTo?: string; // Message ID being replied to
}
