// apps/api/src/models/bank.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IBank extends Document {
  name: string;                // Display name of the bank
  displayName?: string;        // Optional customized display name
  logoUrl?: string;            // URL to the bank's logo
  country: string;             // Country code (e.g., GB, DE)
  supportedPaymentMethods: string[]; // What payment methods this bank supports
  active: boolean;             // Whether this bank is active in our system
  providerMappings: {          // Mapping to different provider bank IDs
    [provider: string]: {
      providerId: string;      // ID in the provider's system
      supportedPaymentMethods: string[];
      lastUpdated: Date;
      active: boolean;         // Whether this provider mapping is active
      metadata?: any;          // Provider-specific data
    }
  };
  createdAt: Date;
  updatedAt: Date;
}

const bankSchema = new Schema<IBank>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    logoUrl: String,
    country: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },
    supportedPaymentMethods: {
      type: [String],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
    providerMappings: {
      type: Map,
      of: new Schema({
        providerId: {
          type: String,
          required: true,
        },
        supportedPaymentMethods: {
          type: [String],
          default: [],
        },
        lastUpdated: {
          type: Date,
          default: Date.now,
        },
        active: {
          type: Boolean,
          default: true,
        },
        metadata: Schema.Types.Mixed,
      }),
      default: {},
    },
  },
  { timestamps: true }
);

// Create indexes for efficient queries
bankSchema.index({ country: 1 });
bankSchema.index({ active: 1 });
bankSchema.index({ name: 'text' });
bankSchema.index({ 'providerMappings.providerId': 1 });

export const Bank = mongoose.model<IBank>('Bank', bankSchema);