export interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  participants: string[];
  admins: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    timestamp: Date;
  };
  unreadCount?: number;
}

export interface ChatParticipant {
  userId: string;
  username: string;
  avatar?: string;
  role: 'admin' | 'member' | 'moderator';
  joinedAt: Date;
  lastSeen?: Date;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  content: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  timestamp: Date;
  edited: boolean;
  deleted: boolean;
  replyTo?: string;
  reactions: Record<string, string[]>;
  metadata?: Record<string, any>;
}

export interface ChatEvent {
  type: 'message' | 'typing' | 'presence' | 'reaction' | 'edit' | 'delete';
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface ChatStats {
  totalMessages: number;
  activeUsers: number;
  lastActivity: Date;
  messageCount: number;
} 