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

/**
 * Postgres array text format: {a,b,"c d",NULL}. The driver is run with fetch_types off (it saves a
 * round trip on every request), which also turns off its array support, so arrays are handled here.
 */
export function parsePgArray(text: string, element: (s: string) => unknown = (s) => s): unknown[] {
  if (text === '{}' || text === '') return [];
  const out: unknown[] = [];
  let i = 1; // skip the opening brace
  while (i < text.length - 1) {
    if (text[i] === '"') {
      let value = '';
      i++;
      while (text[i] !== '"') {
        if (text[i] === '\\') i++;
        value += text[i++];
      }
      i++; // closing quote
      out.push(element(value));
    } else {
      let j = i;
      while (text[j] !== ',' && text[j] !== '}') j++;
      const raw = text.slice(i, j);
      out.push(raw === 'NULL' ? null : element(raw));
      i = j;
    }
    if (text[i] === ',') i++;
  }
  return out;
}

export function serializePgArray(values: unknown[]): string {
  const item = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (Array.isArray(v)) return serializePgArray(v);
    const text = typeof v === 'string' ? v : String(v);
    return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  };
  return `{${values.map(item).join(',')}}`;
}

const arrayType = (oid: number, element?: (s: string) => unknown) => ({
  to: oid,
  from: [oid],
  // Arrays are turned into literals before they reach the driver (see `normalize`); a string passes through
  serialize: (v: unknown) => (typeof v === 'string' ? v : serializePgArray(v as unknown[])),
  parse: (text: string) => parsePgArray(text, element),
});

/**
 * JSON columns. The queries pass JSON as text (`JSON.stringify(x)` with `$n::jsonb`), which is how the
 * in-memory test database wants it. The driver would encode that text a second time and store a JSON
 * *string*, so for JSON parameters a string is taken as already-encoded JSON.
 */
const jsonType = (oid: number) => ({
  to: oid,
  from: [oid],
  serialize: (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v)),
  parse: (text: string) => JSON.parse(text),
});

// text[], varchar[], uuid[] and int4[] are parsed on the way out; everything else arrives as text
export const PG_TYPES = {
  textArray: arrayType(1009),
  varcharArray: arrayType(1015),
  uuidArray: arrayType(2951),
  int4Array: arrayType(1007, Number),
  json: jsonType(114),
  jsonb: jsonType(3802),
};

/**
 * Arrays go to Postgres as array literals, which it reads for any array type, enums included.
 * With fetch_types off the driver cannot serialise an array of a type it does not know (for example
 * `status = any($1)` on an enum column), so this is done here for every parameter.
 */
export function normalizeParams(params: unknown[]): unknown[] {
  return params.map((p) => (Array.isArray(p) ? serializePgArray(p) : p));
}

export function createPostgresDb(connectionString: string): ClosableDb {
  // Hyperdrive pools connections for us, so keep the per-request client small and unprepared.
  const sql = postgres(connectionString, { max: 5, fetch_types: false, prepare: false, idle_timeout: 5, types: PG_TYPES });

  const wrap = (runner: postgres.Sql | postgres.TransactionSql): Db => ({
    query: async (text, params = []) => (await runner.unsafe(text, normalizeParams(params) as any[])) as any,
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
