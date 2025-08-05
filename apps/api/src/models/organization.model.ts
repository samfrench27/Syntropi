import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  plan: 'free' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  contactEmail: string;
  billingEmail?: string;
  stripeCustomerId?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  settings: {
    allowedProviders: string[];
    rateLimit: number;
    webhookUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'growth', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    billingEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    stripeCustomerId: {
      type: String,
      unique: true,
      sparse: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    settings: {
      allowedProviders: {
        type: [String],
        default: [],
      },
      rateLimit: {
        type: Number,
        default: 100,
      },
      webhookUrl: String,
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);