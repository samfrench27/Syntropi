// apps/api/src/models/billing.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBillingUsage extends Document {
  organizationId: Types.ObjectId;
  month: string; // Format: YYYY-MM
  year: number;
  usage: {
    payments: number;
    apiCalls: number;
    successfulPayments: number;
    failedPayments: number;
  };
  costs: {
    paymentFees: number;
    apiCallFees: number;
    subscriptionFee: number;
    totalFees: number;
  };
  limits: {
    paymentsLimit: number;
    apiCallsLimit: number;
    usersLimit: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BillingUsageSchema = new Schema<IBillingUsage>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  usage: {
    payments: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    successfulPayments: { type: Number, default: 0 },
    failedPayments: { type: Number, default: 0 }
  },
  costs: {
    paymentFees: { type: Number, default: 0 },
    apiCallFees: { type: Number, default: 0 },
    subscriptionFee: { type: Number, default: 0 },
    totalFees: { type: Number, default: 0 }
  },
  limits: {
    paymentsLimit: { type: Number, default: 100 },
    apiCallsLimit: { type: Number, default: 1000 },
    usersLimit: { type: Number, default: 5 }
  }
}, {
  timestamps: true
});

// Compound index for organization and month
BillingUsageSchema.index({ organizationId: 1, month: 1 }, { unique: true });
BillingUsageSchema.index({ organizationId: 1, year: 1 });

export const BillingUsage = mongoose.model<IBillingUsage>('BillingUsage', BillingUsageSchema);
