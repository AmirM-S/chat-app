import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  SYSTEM = 'system',
  REPLY = 'reply',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  DELETED = 'deleted',
}

@Schema({
  timestamps: true,
  collection: 'messages',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ type: String, required: true, maxlength: 4000 })
  content: string;

  @Prop({
    type: {
      url: String,
      filename: String,
      mimetype: String,
      size: Number,
      thumbnail: String,
    },
  })
  attachment?: {
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    thumbnail?: string;
  };

  @Prop({
    type: {
      messageId: { type: Types.ObjectId, ref: 'Message' },
      senderId: { type: Types.ObjectId, ref: 'User' },
      content: String,
    },
  })
  replyTo?: {
    messageId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
  };

  @Prop({ type: String, enum: MessageStatus, default: MessageStatus.SENT })
  status: MessageStatus;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy: Types.ObjectId[];

  @Prop({ type: Map, of: Date, default: {} })
  readReceipts: Map<string, Date>;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: Object })
  metadata?: {
    edited?: boolean;
    editedAt?: Date;
    originalContent?: string;
    reactions?: Map<string, Types.ObjectId[]>; // emoji -> user ids
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: Date;
  };

  @Prop({ type: Boolean, default: false })
  isPinned: boolean;

  @Prop({ type: Boolean, default: false })
  isForwarded: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy?: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Create indexes for efficient queries
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, chatId: 1 });
MessageSchema.index({ status: 1, chatId: 1 });
MessageSchema.index({ 'replyTo.messageId': 1 });
MessageSchema.index({ mentions: 1 });
MessageSchema.index({ isPinned: 1, chatId: 1 });
MessageSchema.index({ createdAt: 1 });