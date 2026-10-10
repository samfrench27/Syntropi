import { createRemoteJWKSet } from 'jose';
import { buildApp } from './app';
import { createPostgresDb } from './db';
import { createSupabaseIdentity } from './identity';
import type { AppDeps, Bindings } from './types';

const REQUIRED: (keyof Bindings)[] = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHBOARD_URL', 'HOSTED_PAGES_JWT_SECRET'];

// The public signing keys are fetched once per Worker instance and cached by jose
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // No fallback values: a missing secret is a deployment mistake and must be loud
    const missing = REQUIRED.filter((k) => !env[k]);
    if (missing.length || !env.HYPERDRIVE) {
      console.error(`Missing configuration: ${[...missing, ...(env.HYPERDRIVE ? [] : ['HYPERDRIVE'])].join(', ')}`);
      return Response.json({ success: false, error: { message: 'Service is not configured' } }, { status: 503 });
    }

    jwks ??= createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const db = createPostgresDb(env.HYPERDRIVE.connectionString);

    const deps: AppDeps = {
      db,
      identity: createSupabaseIdentity({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY }),
      jwks,
      config: {
        supabaseUrl: env.SUPABASE_URL,
        dashboardUrl: env.DASHBOARD_URL,
        hostedPagesUrl: env.HOSTED_PAGES_URL,
        mockBankUrl: env.MOCK_BANK_URL,
        hostedPagesJwtSecret: env.HOSTED_PAGES_JWT_SECRET,
        apiBaseUrl: env.API_BASE_URL,
        corsOrigins: [env.DASHBOARD_URL, env.HOSTED_PAGES_URL, env.MOCK_BANK_URL].filter(Boolean) as string[],
      },
      env,
      fetch: (...args) => fetch(...args),
      now: () => new Date(),
    };

    try {
      return await buildApp(deps).fetch(request, env, ctx);
    } finally {
      // Close the connection after the response has been sent
      ctx.waitUntil(db.close());
    }
  },
} satisfies ExportedHandler<Bindings>;
