import type { Db } from '../db';
import { ApiError } from '../http';
import type { AppDeps } from '../types';
import { approvedProviderCodes } from './providerAccess';
import { bankAdapters, SYNC_PROVIDERS, type ProviderBank } from '../adapters/banks';

// ---------------------------------------------------------------------------
// Reading banks (approval-gated)
// ---------------------------------------------------------------------------

export interface BankFilters {
  /** Two-letter country code. Defaults to GB, as the Express service always filtered to GB. */
  country?: string;
  provider?: string;
  paymentMethod?: string;
  search?: string;
}

interface MappingRow {
  providerCode: string;
  providerId: string;
  active: boolean;
  lastUpdated: string;
  supportedPaymentMethods: string[];
  metadata: Record<string, any> | null;
}

/**
 * The provider codes a caller may see banks through, or null for "all" (superadmin).
 * This is the single place the approval rule is applied to bank reads.
 */
export async function allowedProviderScope(db: Db, caller: { organizationId: string; superadmin: boolean }): Promise<string[] | null> {
  if (caller.superadmin) return null;
  return approvedProviderCodes(db, caller.organizationId);
}

const json = (v: unknown) => (v === null ? null : JSON.stringify(v));
const parse = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : (v as T));

// $1 = allowed provider codes as JSON (null = all). Used both to filter and to trim each bank's mappings.
const ALLOWED = `($1::jsonb is null or m.provider_code in (select jsonb_array_elements_text($1::jsonb)))`;

const BANK_COLUMNS = `b.id, b.syntropi_id, b.name, b.display_name, b.logo_url, b.country, b.active,
  to_jsonb(b.supported_payment_methods) as methods,
  (select coalesce(json_agg(json_build_object(
            'providerCode', m.provider_code, 'providerId', m.provider_id, 'active', m.active,
            'lastUpdated', m.last_updated, 'supportedPaymentMethods', m.supported_payment_methods,
            'metadata', m.metadata) order by m.provider_code), '[]'::json)
     from bank_provider_mappings m where m.bank_id = b.id and ${ALLOWED}) as mappings`;

const REACHABLE = `exists (select 1 from bank_provider_mappings m where m.bank_id = b.id and m.active and ${ALLOWED}`;

const FEATURE_NAMES: [string, string][] = [
  ['accountList', 'accountAccess'],
  ['accountBalance', 'accountBalance'],
  ['transactionList', 'transactions'],
  ['singlePayment', 'payments'],
];

/** The response shape of Express's simplifyBankData, built from a row and its (already allowed) mappings. */
function shapeBank(row: any) {
  const mappings = parse<MappingRow[]>(row.mappings) ?? [];
  const providerSupport: Record<string, any> = {};
  let recommendedProvider: string | null = null;
  let best = -1;

  for (const m of mappings) {
    const supported = m.metadata?.supportedFeatures ?? {};
    const features = FEATURE_NAMES.filter(([k]) => supported[k]).map(([, name]) => name);
    providerSupport[m.providerCode] = { available: m.active, features, providerId: m.providerId, lastUpdated: m.lastUpdated };
    if (m.active && features.length > best) {
      best = features.length;
      recommendedProvider = m.providerCode;
    }
  }

  const has = (key: string) => mappings.some((m) => m.metadata?.supportedFeatures?.[key] === true);
  return {
    id: row.syntropi_id,
    uuid: row.id,
    name: row.name,
    displayName: row.display_name ?? null,
    country: row.country,
    logoUrl: row.logo_url ?? undefined,
    supportedPaymentMethods: parse<string[]>(row.methods) ?? [],
    active: row.active,
    features: {
      accountAccess: has('accountList'),
      accountBalance: has('accountBalance'),
      transactions: has('transactionList'),
      payments: has('singlePayment'),
    },
    providerSupport,
    recommendedProvider,
  };
}

/** One page of banks reachable through allowed providers. One query, mappings aggregated in SQL. */
export async function listBanks(db: Db, allowed: string[] | null, filters: BankFilters, page: { limit: number; offset: number }) {
  const rows = await db.query(
    `with filtered as (
       select b.id from banks b
        where b.active
          and b.country = $2::text
          and ($3::text is null or $3::text = any(b.supported_payment_methods))
          and ($4::text is null or b.name ilike $4::text)
          and ${REACHABLE} and ($5::text is null or m.provider_code = $5::text))
     ), total as (select count(*)::int as n from filtered)
     select t.n as total, p.*
       from total t
       left join lateral (
         select ${BANK_COLUMNS}
           from banks b join filtered f on f.id = b.id
          order by b.name, b.id
          limit $6 offset $7
       ) p on true`,
    [json(allowed), (filters.country || 'GB').toUpperCase(), filters.paymentMethod ?? null, filters.search ?? null, filters.provider ?? null, page.limit, page.offset],
  );
  return { banks: rows.filter((r) => r.id).map(shapeBank), total: rows[0]?.total ?? 0 };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A bank by friendly id (gb-monzo) or uuid. 404 when it does not exist OR is not reachable through an allowed provider. */
export async function getBank(db: Db, allowed: string[] | null, idOrSyntropiId: string) {
  const [row] = await db.query(
    `select ${BANK_COLUMNS}
       from banks b
      where b.active and (b.syntropi_id = $2::text or b.id = $3::uuid)
        and ${REACHABLE})
      limit 1`,
    [json(allowed), idOrSyntropiId, UUID.test(idOrSyntropiId) ? idOrSyntropiId : null],
  );
  if (!row) throw new ApiError('Bank not found', 404);
  return shapeBank(row);
}

/** Provider codes the caller may use (all active providers for a superadmin). */
export async function listProviderCodes(db: Db, allowed: string[] | null): Promise<string[]> {
  const rows = await db.query<{ code: string }>(
    `select code from providers where status <> 'inactive' and ($1::jsonb is null or code in (select jsonb_array_elements_text($1::jsonb))) order by code`,
    [json(allowed)],
  );
  return rows.map((r) => r.code);
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncSummary {
  created: number;
  updated: number;
  /** Mappings marked inactive because the provider no longer lists the bank. */
  skipped: number;
  total: number;
  note?: string;
  error?: string;
}

/** Banks written per statement, and the most one provider may import per run (bounds CPU and queries). */
const CHUNK = 250;
const MAX_BANKS_PER_PROVIDER = 5000;

const UPSERT_CHUNK = `
  with input as (
    select * from jsonb_to_recordset($1::jsonb)
      as x(syntropi_id text, provider_id text, name text, country text, logo_url text, methods text[], metadata jsonb)
  ), resolved as (
    -- Same order as Express: friendly id, then the provider's own id, then name + country
    select i.*, coalesce(
      (select b.id from banks b where b.syntropi_id = i.syntropi_id),
      (select m.bank_id from bank_provider_mappings m where m.provider_code = $2 and m.provider_id = i.provider_id limit 1),
      (select b.id from banks b where lower(b.name) = lower(i.name) and b.country = i.country order by b.created_at, b.id limit 1)
    ) as bank_id
    from input i
  ), existing as (
    select distinct on (bank_id) * from resolved where bank_id is not null order by bank_id
  ), created as (
    insert into banks (syntropi_id, name, country, logo_url, supported_payment_methods)
    select syntropi_id, name, country, logo_url, methods from resolved where bank_id is null
    on conflict (syntropi_id) do nothing
    returning id, syntropi_id
  ), updated as (
    update banks b set
      supported_payment_methods = (select coalesce(array_agg(distinct u order by u), '{}') from unnest(b.supported_payment_methods || e.methods) u),
      logo_url = coalesce(b.logo_url, e.logo_url)
    from existing e where b.id = e.bank_id
    returning b.id
  ), targets as (
    select e.bank_id, e.provider_id, e.methods, e.metadata from existing e
    union all
    select c.id, r.provider_id, r.methods, r.metadata from created c join resolved r on r.syntropi_id = c.syntropi_id and r.bank_id is null
  ), mapped as (
    insert into bank_provider_mappings (bank_id, provider_code, provider_id, supported_payment_methods, active, last_updated, metadata)
    select bank_id, $2, provider_id, methods, true, $3::timestamptz, coalesce(metadata, '{}'::jsonb) from targets
    on conflict (bank_id, provider_code) do update set
      provider_id = excluded.provider_id, supported_payment_methods = excluded.supported_payment_methods,
      active = true, last_updated = excluded.last_updated, metadata = excluded.metadata
    returning 1
  )
  select (select count(*) from created)::int as created, (select count(*) from updated)::int as updated, (select count(*) from mapped)::int as mapped`;

/** Mark every active mapping for this provider that the run did not touch as inactive. */
const MARK_STALE = `update bank_provider_mappings set active = false
  where provider_code = $1 and active and last_updated < $2::timestamptz returning 1`;

async function upsertBanks(db: Db, provider: string, banks: ProviderBank[], startedAt: string) {
  // Two provider entries can produce the same friendly id; the later one wins, as it did sequentially in Express
  const byId = new Map<string, ProviderBank>();
  for (const b of banks) byId.set(b.id, b);
  const unique = [...byId.values()];

  let created = 0;
  let updated = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const payload = unique.slice(i, i + CHUNK).map((b) => ({
      syntropi_id: b.id,
      provider_id: b.originalId || b.id,
      name: b.name,
      country: b.country,
      logo_url: b.logoUrl ?? null,
      methods: b.supportedPaymentMethods,
      metadata: b.metadata ?? {},
    }));
    const [r] = await db.query<{ created: number; updated: number }>(UPSERT_CHUNK, [JSON.stringify(payload), provider, startedAt]);
    created += r.created;
    updated += r.updated;
  }
  return { created, updated };
}

/**
 * Import bank lists from the providers (all supported ones by default). Safe to call from the
 * cron handler or the POST /sync route. Each provider is independent: a failure or missing
 * credentials is reported in its own summary entry and never stops the others.
 */
export async function syncBanksFromProviders(deps: AppDeps, providers?: string[]): Promise<Record<string, SyncSummary>> {
  const results: Record<string, SyncSummary> = {};
  const startedAt = deps.now().toISOString();

  for (const provider of providers?.length ? providers : SYNC_PROVIDERS) {
    const adapter = bankAdapters[provider];
    if (!adapter) {
      results[provider] = { error: `Unsupported provider: ${provider}` } as SyncSummary;
      continue;
    }
    const unavailable = adapter.unavailableReason(deps.env);
    if (unavailable) {
      results[provider] = { created: 0, updated: 0, skipped: 0, total: 0, note: `Skipped: ${unavailable}` };
      continue;
    }

    let banks: ProviderBank[];
    try {
      banks = await adapter.getBanks(deps);
    } catch (err) {
      console.error(`Bank sync: fetching ${provider} failed:`, err);
      results[provider] = { error: err instanceof Error ? err.message : 'Failed to fetch banks' } as SyncSummary;
      continue;
    }

    try {
      const truncated = banks.length > MAX_BANKS_PER_PROVIDER;
      if (truncated) banks = banks.slice(0, MAX_BANKS_PER_PROVIDER);

      const { created, updated } = await upsertBanks(deps.db, provider, banks, startedAt);

      // An empty or truncated list is not evidence that banks were removed, so nothing is deactivated
      let skipped = 0;
      let note: string | undefined;
      if (banks.length === 0) note = 'Provider returned no banks; existing mappings left unchanged';
      else if (truncated) note = `Provider returned more than ${MAX_BANKS_PER_PROVIDER} banks; extra banks ignored and no mappings deactivated`;
      else skipped = (await deps.db.query(MARK_STALE, [provider, startedAt])).length;

      results[provider] = { created, updated, skipped, total: created + updated + skipped, ...(note ? { note } : {}) };
    } catch (err) {
      console.error(`Bank sync: saving ${provider} banks failed:`, err);
      results[provider] = { error: 'Failed to save banks' } as SyncSummary;
    }
  }
  return results;
}

/**
 * Remove banks outside GB (older imports). Mock banks are kept: they are the practice banks
 * every organization has and some are deliberately in other countries. Returns the number deleted.
 */
export async function cleanupNonGBBanks(db: Db): Promise<number> {
  const rows = await db.query(
    `delete from banks b where b.country <> 'GB'
       and not exists (select 1 from bank_provider_mappings m where m.bank_id = b.id and m.provider_code = 'mock')
     returning 1`,
  );
  return rows.length;
}
