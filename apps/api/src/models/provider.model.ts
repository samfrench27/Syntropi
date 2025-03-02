import mongoose, { Document, Schema } from 'mongoose';

export interface IProvider extends Document {
  name: string;
  code: string;
  description: string;
  logoUrl?: string;
  apiSpec: {
    baseUrl: string;
    version: string;
    documentation: string;
  };
  features: string[];
  status: 'active' | 'maintenance' | 'inactive';
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    logoUrl: String,
    apiSpec: {
      baseUrl: {
        type: String,
        required: true,
      },
      version: {
        type: String,
        required: true,
      },
      documentation: String,
    },
    features: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export const Provider = mongoose.model<IProvider>('Provider', providerSchema);