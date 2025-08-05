// apps/api/src/models/subscription.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubscription extends Document {
  organizationId: Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  stripeProductId: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true // One subscription per organization
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  stripePriceId: {
    type: String,
    required: true
  },
  stripeProductId: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['starter', 'growth', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'canceled', 'past_due', 'unpaid', 'incomplete'],
    required: true,
    default: 'inactive'
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
SubscriptionSchema.index({ organizationId: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
