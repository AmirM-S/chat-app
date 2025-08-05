export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface WebSocketEvent {
  event: string;
  data: any;
  timestamp: Date;
  userId?: string;
  roomId?: string;
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: Date;
  path?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface UserContext {
  userId: string;
  username: string;
  email: string;
  roles?: string[];
  permissions?: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface CacheOptions {
  ttl?: number;
  key?: string;
  tags?: string[];
}

export interface NotificationData {
  id: string;
  type: 'message' | 'mention' | 'reaction' | 'system';
  title: string;
  body: string;
  userId: string;
  chatId?: string;
  messageId?: string;
  read: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
} 