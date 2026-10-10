import { readFileSync, existsSync } from 'node:fs';
import postgres from 'postgres';
import { GoTrueClient } from '@supabase/auth-js';

/** Settings for local scripts: the Worker's own .dev.vars file, overridden by real environment variables. */
export function loadEnv() {
  const env = {};
  if (existsSync('.dev.vars')) {
    for (const line of readFileSync('.dev.vars', 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0 && !line.startsWith('#')) env[line.slice(0, i)] = line.slice(i + 1);
    }
  }
  return { ...env, ...process.env };
}

export function connect(env) {
  const url = env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE || env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL (the api_worker connection string) or add it to .dev.vars');
  return postgres(url, { max: 1, prepare: false });
}

export function adminAuth(env) {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env[name]) throw new Error(`${name} is not set`);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return new GoTrueClient({
    url: `${env.SUPABASE_URL}/auth/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  }).admin;
}

export function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
