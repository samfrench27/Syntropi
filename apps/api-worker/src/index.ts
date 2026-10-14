import { createRemoteJWKSet } from 'jose';
import { buildApp } from './app';
import { createPostgresDb, type Db } from './db';
import { createSupabaseIdentity } from './identity';
import { syncBanksFromProviders } from './services/banks';
import { settleDueMockPayments } from './services/payments';
import type { AppDeps, Bindings } from './types';

const REQUIRED: (keyof Bindings)[] = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHBOARD_URL', 'HOSTED_PAGES_JWT_SECRET'];

// The public signing keys are fetched once per Worker instance and cached by jose
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** No fallback values: a missing secret is a deployment mistake and must be loud. Returns the problem, or null. */
function configProblem(env: Bindings): string | null {
  const missing: string[] = REQUIRED.filter((k) => !env[k]);
  if (!env.HYPERDRIVE) missing.push('HYPERDRIVE');
  return missing.length ? `Missing configuration: ${missing.join(', ')}` : null;
}

function buildDeps(env: Bindings, db: Db): AppDeps {
  jwks ??= createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  return {
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
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const problem = configProblem(env);
    if (problem) {
      console.error(problem);
      return Response.json({ success: false, error: { message: 'Service is not configured' } }, { status: 503 });
    }

    const db = createPostgresDb(env.HYPERDRIVE!.connectionString);
    try {
      return await buildApp(buildDeps(env, db)).fetch(request, env, ctx);
    } finally {
      // Close the connection after the response has been sent
      ctx.waitUntil(db.close());
    }
  },

  /** Cron triggers (see wrangler.toml): every minute, apply due Mock bank status steps; daily, refresh the bank list. */
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
    const everyMinute = controller.cron === '* * * * *';
    const job = everyMinute ? 'Mock bank settlement' : 'Bank sync';
    const problem = configProblem(env);
    if (problem) {
      console.error(`${job} skipped. ${problem}`);
      return;
    }
    const db = createPostgresDb(env.HYPERDRIVE!.connectionString);
    try {
      const deps = buildDeps(env, db);
      if (everyMinute) {
        const settled = await settleDueMockPayments(deps);
        if (settled > 0) console.log(`Mock bank settlement looked at ${settled} payments`);
      } else {
        const summary = await syncBanksFromProviders(deps);
        console.log('Bank sync finished', JSON.stringify(summary));
      }
    } catch (error) {
      console.error(`${job} failed`, error);
    } finally {
      ctx.waitUntil(db.close());
    }
  },
} satisfies ExportedHandler<Bindings>;
