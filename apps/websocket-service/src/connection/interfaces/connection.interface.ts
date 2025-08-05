import { Socket } from 'socket.io';

export interface UserConnection {
  userId: string;
  username: string;
  socketId: string;
  connectedAt: Date;
  lastSeen: Date;
  isOnline: boolean;
  activeChats: string[];
  status: 'online' | 'away' | 'busy' | 'offline';
}

export interface RoomConnection {
  roomId: string;
  roomType: 'chat' | 'presence' | 'system';
  participants: string[];
  createdAt: Date;
  lastActivity: Date;
}

export interface ConnectionStats {
  totalConnections: number;
  activeUsers: number;
  totalRooms: number;
  peakConnections: number;
  averageConnectionsPerMinute: number;
}

export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'join_room' | 'leave_room';
  userId: string;
  socketId: string;
  timestamp: Date;
  data?: any;
}

export interface SocketWithUser extends Socket {
  data: {
    user: {
      sub: string;
      username: string;
      email: string;
    };
  };
} 