import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  name: string;
  key: string;
  organization: mongoose.Types.ObjectId;
  environment: 'sandbox' | 'production';
  permissions: string[];
  createdBy: mongoose.Types.ObjectId;
  lastUsed?: Date;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    permissions: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastUsed: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Generate a secure API key
export const generateApiKey = (): string => {
  return `sk_${crypto.randomBytes(24).toString('hex')}`;
};

export const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);