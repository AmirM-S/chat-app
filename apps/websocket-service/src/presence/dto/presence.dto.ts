import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export class UpdatePresenceDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;

  @IsOptional()
  @IsString()
  customStatus?: string;

  @IsOptional()
  @IsString()
  activeChatId?: string;
}

export class SetActiveChatDto {
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsOptional()
  @IsDateString()
  lastSeen?: string;
}

export class GetPresenceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export interface PresenceData {
  userId: string;
  username: string;
  status: UserStatus;
  customStatus?: string;
  activeChatId?: string;
  lastSeen: Date;
  isOnline: boolean;
  avatar?: string;
}

export interface UserPresence {
  userId: string;
  status: UserStatus;
  customStatus?: string;
  activeChatId?: string;
  lastSeen: Date;
  isOnline: boolean;
  avatar?: string;
} 