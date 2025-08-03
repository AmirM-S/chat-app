import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

export enum ChatType {
  DIRECT = 'direct',
  GROUP = 'group',
  CHANNEL = 'channel',
}

export enum ChatStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

@Schema({
  timestamps: true,
  collection: 'chats',
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Chat {
  @Prop({ type: String, enum: ChatType, required: true })
  type: ChatType;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: String })
  avatar?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  participants: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  admins: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage?: Types.ObjectId;

  @Prop({ type: Date })
  lastActivity: Date;

  @Prop({ type: String, enum: ChatStatus, default: ChatStatus.ACTIVE })
  status: ChatStatus;

  @Prop({ type: Number, default: 0 })
  messageCount: number;

  @Prop({
    type: Map,
    of: {
      role: { type: String, enum: ['member', 'admin', 'owner'] },
      joinedAt: Date,
      lastRead: Date,
      unreadCount: { type: Number, default: 0 },
    },
    default: {},
  })
  participantSettings: Map<string, any>;

  @Prop({ type: Object, default: {} })
  settings: {
    isPublic?: boolean;
    allowInvites?: boolean;
    mutedUntil?: Date;
    pinnedMessages?: Types.ObjectId[];
  };

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Create indexes for better performance
ChatSchema.index({ participants: 1, status: 1 });
ChatSchema.index({ type: 1, status: 1 });
ChatSchema.index({ lastActivity: -1 });
ChatSchema.index({ createdBy: 1 });
ChatSchema.index({ 'settings.isPublic': 1, status: 1 });