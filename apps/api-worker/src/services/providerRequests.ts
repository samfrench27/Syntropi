import { z } from 'zod';
import type { Db } from '../db';
import { ApiError } from '../http';
import { MOCK_PROVIDER } from './providerAccess';

export const ACCESS_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export const uuidText = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Must be a valid id');
const note = (max = 1000) => z.string().trim().max(max);
export const requestBody = z.object({ note: note().optional() });
export const optionalNoteBody = z.object({ note: note().optional() });
export const requiredNoteBody = z.object({ note: note().min(1, 'A note is required') });

// ---------------------------------------------------------------------------
// Client side: an organization's own view and requests
// ---------------------------------------------------------------------------

export interface ClientProvider {
  code: string;
  name: string;
  description: string;
  logoUrl: string | null;
  features: string[];
  /** 'active' or 'maintenance'. Inactive providers are not listed. */
  status: string;
  /** none | pending | approved | rejected | revoked. `mock` is always approved. */
  accessStatus: 'none' | AccessStatus;
  alwaysOn: boolean;
  requestNote: string | null;
  reviewNote: string | null;
  requestedAt: Date | string | null;
  reviewedAt: Date | string | null;
}

const clientRow = (r: any): ClientProvider => {
  const alwaysOn = r.code === MOCK_PROVIDER;
  return {
    code: r.code,
    name: r.name,
    description: r.description,
    logoUrl: r.logo_url,
    features: r.features,
    status: r.status,
    accessStatus: alwaysOn ? 'approved' : (r.access_status ?? 'none'),
    alwaysOn,
    requestNote: alwaysOn ? null : r.request_note,
    reviewNote: alwaysOn ? null : r.review_note,
    requestedAt: alwaysOn ? null : r.requested_at,
    reviewedAt: alwaysOn ? null : r.reviewed_at,
  };
};

const CLIENT_SELECT = `select p.code, p.name, p.description, p.logo_url, p.features, p.status::text as status,
       pa.status::text as access_status, pa.request_note, pa.review_note, pa.requested_at, pa.reviewed_at
  from providers p
  left join provider_access pa on pa.provider_code = p.code and pa.organization_id = $1`;

export async function listForOrganization(db: Db, organizationId: string): Promise<ClientProvider[]> {
  const rows = await db.query(`${CLIENT_SELECT} where p.status <> 'inactive' order by (p.code = 'mock') desc, p.name`, [organizationId]);
  return rows.map(clientRow);
}

/** Ask for access. Returns the provider as the organization now sees it, and whether anything changed. */
export async function requestAccess(
  db: Db,
  p: { organizationId: string; userId: string; code: string; note?: string },
): Promise<{ provider: ClientProvider; created: boolean; requestId: string }> {
  if (p.code === MOCK_PROVIDER) throw new ApiError('The Mock bank is always available and needs no approval', 400, 'PROVIDER_ALWAYS_ON');

  const [provider] = await db.query<{ code: string }>(`select code from providers where code = $1 and status <> 'inactive'`, [p.code]);
  if (!provider) throw new ApiError('Provider not found', 404);

  // One statement decides: a new request, or a re-request of a rejected/revoked one. Pending and approved rows are left alone.
  const [written] = await db.query<{ id: string }>(
    `insert into provider_access (organization_id, provider_code, status, requested_by, request_note, requested_at)
     values ($1, $2, 'pending', $3, $4, now())
     on conflict (organization_id, provider_code) do update
        set status = 'pending', requested_by = excluded.requested_by, request_note = excluded.request_note,
            requested_at = now(), reviewed_by = null, reviewed_at = null, review_note = null
      where provider_access.status in ('rejected', 'revoked')
     returning id`,
    [p.organizationId, p.code, p.userId, p.note || null],
  );

  let requestId = written?.id;
  if (!written) {
    const [existing] = await db.query<{ id: string; status: AccessStatus }>(
      `select id, status from provider_access where organization_id = $1 and provider_code = $2`,
      [p.organizationId, p.code],
    );
    if (existing?.status === 'approved') throw new ApiError('This provider is already approved for your organization', 409, 'ALREADY_APPROVED');
    requestId = existing.id; // already pending: asking again changes nothing
  }

  const [row] = await db.query(`${CLIENT_SELECT} where p.code = $2`, [p.organizationId, p.code]);
  return { provider: clientRow(row), created: !!written, requestId };
}

// ---------------------------------------------------------------------------
// Admin side: the approval queue
// ---------------------------------------------------------------------------

const person = (id: string | null, first: string | null, last: string | null, email: string | null) =>
  id ? { id, name: `${first ?? ''} ${last ?? ''}`.trim(), email } : null;

const QUEUE_SELECT = `select pa.id, pa.organization_id, o.name as organization_name, pa.provider_code, pr.name as provider_name,
       pa.status::text as status, pa.request_note, pa.requested_at, pa.reviewed_at, pa.review_note, pa.created_at, pa.updated_at,
       rq.id as rq_id, rq.first_name as rq_first, rq.last_name as rq_last, rq.email as rq_email,
       rv.id as rv_id, rv.first_name as rv_first, rv.last_name as rv_last, rv.email as rv_email
  from provider_access pa
  join organizations o on o.id = pa.organization_id
  join providers pr on pr.code = pa.provider_code
  left join profiles rq on rq.id = pa.requested_by
  left join profiles rv on rv.id = pa.reviewed_by`;

const queueRow = (r: any) => ({
  id: r.id,
  organizationId: r.organization_id,
  organizationName: r.organization_name,
  providerCode: r.provider_code,
  providerName: r.provider_name,
  status: r.status as AccessStatus,
  requestNote: r.request_note,
  requestedAt: r.requested_at,
  requestedBy: person(r.rq_id, r.rq_first, r.rq_last, r.rq_email),
  reviewedAt: r.reviewed_at,
  reviewedBy: person(r.rv_id, r.rv_first, r.rv_last, r.rv_email),
  reviewNote: r.review_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listRequests(db: Db, f: { status?: AccessStatus; organizationId?: string; limit: number; offset: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) where.push(`pa.status = $${params.push(f.status)}::provider_access_status`);
  if (f.organizationId) where.push(`pa.organization_id = $${params.push(f.organizationId)}::uuid`);
  const clause = where.length ? `where ${where.join(' and ')}` : '';

  const [{ total }] = await db.query<{ total: number }>(`select count(*)::int as total from provider_access pa ${clause}`, params);
  const rows = await db.query(
    `${QUEUE_SELECT} ${clause} order by pa.requested_at desc, pa.id limit ${f.limit} offset ${f.offset}`,
    params,
  );
  const countRows = await db.query<{ status: AccessStatus; n: number }>(`select status::text as status, count(*)::int as n from provider_access group by status`);
  const counts = { pending: 0, approved: 0, rejected: 0, revoked: 0 };
  for (const c of countRows) counts[c.status] = c.n;

  return { requests: rows.map(queueRow), total, counts };
}

export async function getRequest(db: Db, id: string) {
  const [row] = await db.query(`${QUEUE_SELECT} where pa.id = $1`, [id]);
  if (!row) throw new ApiError('Request not found', 404);
  return queueRow(row);
}

type Verb = 'approve' | 'reject' | 'revoke';
const TRANSITIONS: Record<Verb, { from: AccessStatus[]; to: AccessStatus }> = {
  approve: { from: ['pending', 'rejected'], to: 'approved' },
  reject: { from: ['pending'], to: 'rejected' },
  revoke: { from: ['approved'], to: 'revoked' },
};

/** Review a request. Only valid transitions apply, and the check and the write are one statement. */
export async function review(db: Db, p: { id: string; verb: Verb; reviewerId: string; note?: string }) {
  const t = TRANSITIONS[p.verb];
  const [changed] = await db.query<{ id: string; organization_id: string; provider_code: string; status: string }>(
    `update provider_access
        set status = $2::provider_access_status, reviewed_by = $3, reviewed_at = now(), review_note = $4
      where id = $1 and status = any($5::provider_access_status[])
      returning id, organization_id, provider_code, status`,
    [p.id, t.to, p.reviewerId, p.note || null, t.from],
  );
  if (!changed) {
    const [existing] = await db.query<{ status: string }>(`select status::text as status from provider_access where id = $1`, [p.id]);
    if (!existing) throw new ApiError('Request not found', 404);
    throw new ApiError(`Cannot ${p.verb} a request that is ${existing.status}`, 409, 'INVALID_TRANSITION');
  }
  return { organizationId: changed.organization_id, providerCode: changed.provider_code, request: await getRequest(db, p.id) };
}
