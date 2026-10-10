import type { Db } from '../db';
import { ApiError } from '../http';

/** The practice bank. Every organization has it, with no approval and no database row. */
export const MOCK_PROVIDER = 'mock';

/**
 * The provider codes an organization may use: the Mock bank plus every real provider a Syntropi
 * admin has approved for it. Rejected, revoked and pending requests do not count.
 */
export async function approvedProviderCodes(db: Db, organizationId: string): Promise<string[]> {
  const rows = await db.query<{ provider_code: string }>(
    `select pa.provider_code
       from provider_access pa join providers p on p.code = pa.provider_code
      where pa.organization_id = $1 and pa.status = 'approved' and p.status <> 'inactive'
      order by pa.provider_code`,
    [organizationId],
  );
  return [MOCK_PROVIDER, ...rows.map((r) => r.provider_code)];
}

/** Throws the standard 403 unless the organization may use this provider. */
export async function assertProviderAllowed(db: Db, organizationId: string, providerCode: string): Promise<void> {
  if (providerCode === MOCK_PROVIDER) return;
  const allowed = await approvedProviderCodes(db, organizationId);
  if (!allowed.includes(providerCode)) {
    throw new ApiError(
      `Your organization is not approved to use ${providerCode}. Request access from the Providers page.`,
      403,
      'PROVIDER_NOT_APPROVED',
    );
  }
}
