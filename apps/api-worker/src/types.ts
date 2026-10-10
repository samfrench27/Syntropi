import type { JWTVerifyGetKey } from 'jose';
import type { Db } from './db';
import type { Identity } from './identity';
import type { PaymentTokenClaims } from './lib/paymentToken';

export type Role = 'superadmin' | 'admin' | 'user';

/** Secrets and settings. Everything comes from the environment; nothing has a fallback value. */
export interface Bindings {
  HYPERDRIVE?: { connectionString: string };
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DASHBOARD_URL: string;
  HOSTED_PAGES_URL?: string;
  MOCK_BANK_URL?: string;
  HOSTED_PAGES_JWT_SECRET: string;
  TOKEN_API_KEY?: string;
  TOKEN_API_BASE_URL?: string;
  YAPILY_CLIENT_ID?: string;
  YAPILY_CLIENT_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_STARTER_PRICE_ID?: string;
  STRIPE_GROWTH_PRICE_ID?: string;
  STRIPE_ENTERPRISE_PRICE_ID?: string;
  STRIPE_STARTER_PRODUCT_ID?: string;
  STRIPE_GROWTH_PRODUCT_ID?: string;
  STRIPE_ENTERPRISE_PRODUCT_ID?: string;
  TOKEN_WEBHOOK_SECRET?: string;
  API_BASE_URL?: string;
}

/** Everything a request handler may depend on. Tests swap these for in-memory versions. */
export interface AppDeps {
  db: Db;
  identity: Identity;
  /** Supabase's public signing keys, used to verify access tokens. */
  jwks: JWTVerifyGetKey;
  config: {
    supabaseUrl: string;
    dashboardUrl: string;
    hostedPagesUrl?: string;
    mockBankUrl?: string;
    hostedPagesJwtSecret: string;
    apiBaseUrl?: string;
    corsOrigins: string[];
  };
  /** Secrets and settings the provider adapters and Stripe read. */
  env: Partial<Bindings>;
  /** Outbound HTTP. Replaced in tests so no real provider is called. */
  fetch: typeof fetch;
  now: () => Date;
}

export interface AuthUser {
  userId: string;
  role: Role;
  organizationId: string;
  email: string;
}

export interface ApiKeyAuth {
  id: string;
  name: string;
  organizationId: string;
  permissions: string[];
  environment: 'sandbox' | 'production';
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    deps: AppDeps;
    user: AuthUser;
    apiKey: ApiKeyAuth;
    /** Set by flexibleAuth for API keys, hosted-page tokens and signed-in users alike. */
    organizationId: string;
    isSuperadmin: boolean;
    paymentToken?: PaymentTokenClaims;
  };
};
