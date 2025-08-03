import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ParticipantDocument = Participant & Document;

export enum ParticipantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum ParticipantStatus {
  ACTIVE = 'active',
  MUTED = 'muted',
  BANNED = 'banned',
  LEFT = 'left',
}

@Schema({
  timestamps: true,
  collection: 'participants',
})
export class Participant {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ParticipantRole, default: ParticipantRole.MEMBER })
  role: ParticipantRole;

  @Prop({ type: String, enum: ParticipantStatus, default: ParticipantStatus.ACTIVE })
  status: ParticipantStatus;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  @Prop({ type: Date })
  leftAt?: Date;

  @Prop({ type: Date, default: Date.now })
  lastRead: Date;

  @Prop({ type: Number, default: 0 })
  unreadCount: number;

  @Prop({ type: Date })
  mutedUntil?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  preferences: {
    notifications?: boolean;
    sound?: boolean;
    mentionOnly?: boolean;
  };
}

export const ParticipantSchema = SchemaFactory.createForClass(Participant);

// Create compound indexes
ParticipantSchema.index({ chatId: 1, userId: 1 }, { unique: true });
ParticipantSchema.index({ userId: 1, status: 1 });
ParticipantSchema.index({ chatId: 1, status: 1 });