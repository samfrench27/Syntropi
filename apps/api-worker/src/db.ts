import postgres from 'postgres';

/**
 * The only way handlers touch the database. Two implementations: postgres.js through
 * Hyperdrive in production, and PGlite in tests. Placeholders are $1, $2, ...
 */
export interface Db {
  query<T = Record<string, any>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements in one transaction. Throwing rolls everything back. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

export interface ClosableDb extends Db {
  close(): Promise<void>;
}

export function createPostgresDb(connectionString: string): ClosableDb {
  // Hyperdrive pools connections for us, so keep the per-request client small and unprepared.
  const sql = postgres(connectionString, { max: 5, fetch_types: false, prepare: false, idle_timeout: 5 });

  const wrap = (runner: postgres.Sql | postgres.TransactionSql): Db => ({
    query: async (text, params = []) => (await runner.unsafe(text, params as any[])) as any,
    tx: (fn) => (runner as postgres.Sql).begin((t) => fn(wrap(t))) as any,
  });

  return { ...wrap(sql), close: () => sql.end({ timeout: 1 }) };
}

/** snake_case row -> camelCase object, for building API responses. */
export function camel<T = Record<string, any>>(row: Record<string, any> | undefined): T {
  if (!row) return row as T;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out as T;
}

/** Escape % and _ so user input can't act as a wildcard in LIKE/ILIKE. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
}
