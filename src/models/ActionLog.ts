import mongoose, { Document, Schema } from 'mongoose';

export interface IActionLog extends Document {
  botId: string;
  category: string;
  action: string;
  userId: string;
  username?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const ActionLogSchema = new Schema(
  {
    botId: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActionLogSchema.index({ createdAt: -1 });
ActionLogSchema.index({ botId: 1, createdAt: -1 });

export const ActionLog = mongoose.model<IActionLog>('ActionLog', ActionLogSchema);
