// apps/api/src/models/payment.model.ts
import mongoose, { Schema, Document } from 'mongoose';

// Syntropi unified payment flow types
export enum PaymentFlowType {
  API_ONLY = 'API_ONLY',
  HOSTED_PAGES = 'HOSTED_PAGES',
  EMBEDDED_HOSTED_PAGES = 'EMBEDDED_HOSTED_PAGES'
}

// Syntropi unified payment status
export enum PaymentStatus {
  PENDING = 'PENDING',           // Initial state, awaiting authorization
  AUTHORIZING = 'AUTHORIZING',   // User is authorizing with bank
  AUTHORIZED = 'AUTHORIZED',     // User has authorized, ready to submit
  SUBMITTED = 'SUBMITTED',       // Payment submitted to bank
  ACCEPTED = 'ACCEPTED',         // Bank accepted payment
  COMPLETED = 'COMPLETED',       // Payment successfully completed
  FAILED = 'FAILED',             // Payment failed
  CANCELLED = 'CANCELLED',       // Payment cancelled by user/system
  EXPIRED = 'EXPIRED'            // Payment authorization expired
}

// Account details for payment
export interface AccountDetails {
  accountNumber?: string;
  sortCode?: string;          // UK
  iban?: string;              // SEPA
  bic?: string;               // SEPA
  accountName: string;
  bankName?: string;
}

// Amount with currency
export interface Amount {
  value: string;              // Decimal string (e.g., "10.50")
  currency: string;           // ISO 4217 currency code
}

// Payment reference information
export interface PaymentReference {
  reference?: string;         // Payment reference/description
  endToEndId?: string;        // End-to-end ID for tracking
}

// Provider-specific data and responses
export interface ProviderData {
  provider: string;           // 'token', 'yapily', etc.
  originalPaymentId?: string; // Provider's payment ID
  bankId?: string;           // Provider's bank ID
  redirectUrl?: string;      // Auth redirect URL
  metadata?: any;            // Provider-specific data
  rawResponse?: any;         // Store full provider response
}

// Payment document interface
export interface IPayment extends Document {
  // Syntropi identifiers
  paymentId: string;          // Our unique payment ID
  clientId: string;           // Client making the payment
  organizationId: string;     // Organization the client belongs to
  
  // Payment details
  fromAccount?: AccountDetails;
  toAccount: AccountDetails;
  amount: Amount;
  reference: PaymentReference;
  
  // Flow configuration
  flowType: PaymentFlowType;
  redirectUrl?: string;       // Client's redirect URL after payment
  
  // Status and provider
  status: PaymentStatus;
  provider: string;           // Selected provider
  bankId?: string;           // Selected bank
  
  // Provider-specific data
  providerData: ProviderData;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;          // When payment authorization expires
  completedAt?: Date;        // When payment was completed
  
  // Error tracking
  errorCode?: string;
  errorMessage?: string;
  
  // Audit trail
  statusHistory: Array<{
    status: PaymentStatus;
    timestamp: Date;
    provider?: string;
    details?: string;
  }>;

  // Instance methods
  updateStatus(status: PaymentStatus, details?: string): void;
}

// Payment schema
const paymentSchema = new Schema<IPayment>({
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clientId: {
    type: String,
    required: true,
    index: true
  },
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  
  // Payment details
  fromAccount: {
    type: {
      accountNumber: String,
      sortCode: String,
      iban: String,
      bic: String,
      accountName: { type: String, required: true },
      bankName: String
    },
    required: false
  },
  toAccount: {
    accountNumber: String,
    sortCode: String,
    iban: String,
    bic: String,
    accountName: { type: String, required: true },
    bankName: String
  },
  amount: {
    value: { type: String, required: true },
    currency: { type: String, required: true, default: 'GBP' }
  },
  reference: {
    reference: String,
    endToEndId: String
  },
  
  // Flow configuration
  flowType: {
    type: String,
    enum: Object.values(PaymentFlowType),
    default: PaymentFlowType.API_ONLY
  },
  redirectUrl: String,
  
  // Status and provider
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
    index: true
  },
  provider: {
    type: String,
    required: true,
    index: true
  },
  bankId: String,
  
  // Provider-specific data
  providerData: {
    provider: { type: String, required: true },
    originalPaymentId: String,
    bankId: String,
    redirectUrl: String,
    metadata: Schema.Types.Mixed,
    rawResponse: Schema.Types.Mixed
  },
  
  // Metadata
  expiresAt: Date,
  completedAt: Date,
  
  // Error tracking
  errorCode: String,
  errorMessage: String,
  
  // Audit trail
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    provider: String,
    details: String
  }]
}, {
  timestamps: true,
  collection: 'payments'
});

// Add indexes for efficient queries
paymentSchema.index({ clientId: 1, status: 1 });
paymentSchema.index({ organizationId: 1, status: 1 });
paymentSchema.index({ provider: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ expiresAt: 1 });

// Pre-save middleware to add status to history
paymentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      provider: this.provider,
      details: `Status changed to ${this.status}`
    });
  }
  next();
});

// Methods
paymentSchema.methods.updateStatus = function(status: PaymentStatus, details?: string) {
  this.status = status;
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    provider: this.provider,
    details: details || `Status updated to ${status}`
  });
  
  if (status === PaymentStatus.COMPLETED) {
    this.completedAt = new Date();
  }
};

// Static methods
paymentSchema.statics.findByClientId = function(clientId: string) {
  return this.find({ clientId }).sort({ createdAt: -1 });
};

paymentSchema.statics.findActivePayments = function() {
  return this.find({
    status: { 
      $in: [
        PaymentStatus.PENDING,
        PaymentStatus.AUTHORIZING,
        PaymentStatus.AUTHORIZED,
        PaymentStatus.SUBMITTED
      ]
    }
  });
};

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
