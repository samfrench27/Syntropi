import type { TestApp } from './helpers/app';

/**
 * Extra rows on top of seedTenants (orgA/userA, orgB/userB, both org admins): a platform
 * organization with a superadmin, and a plain `user` in each tenant. All data is fictional.
 */
export async function seedPeople(t: TestApp) {
  const ids = {
    platformOrg: '00000000-0000-0000-0000-0000000000c1',
    superId: '00000000-0000-0000-0000-0000000000c2',
    plainA: '00000000-0000-0000-0000-0000000000a3',
    plainB: '00000000-0000-0000-0000-0000000000b3',
    missing: '00000000-0000-0000-0000-0000000000ff',
  };
  await t.admin((pg) =>
    pg.exec(`
      insert into organizations (id, name, contact_email) values ('${ids.platformOrg}', 'Syntropi Platform', 'ops@syntropi.test');
      insert into auth.users (id, email) values
        ('${ids.superId}', 'root@syntropi.test'),
        ('${ids.plainA}', 'pat@acme.test'),
        ('${ids.plainB}', 'quinn@borealis.test');
      insert into profiles (id, email, first_name, last_name, role, organization_id) values
        ('${ids.superId}', 'root@syntropi.test', 'Root', 'Operator', 'superadmin', '${ids.platformOrg}'),
        ('${ids.plainA}', 'pat@acme.test', 'Pat', 'Picker', 'user', '${t.ids.orgA}'),
        ('${ids.plainB}', 'quinn@borealis.test', 'Quinn', 'Quill', 'user', '${t.ids.orgB}');
    `),
  );
  return { ...t.ids, ...ids };
}

export type People = Awaited<ReturnType<typeof seedPeople>>;

/** Insert an activity row directly (as the test superuser). */
export async function addActivity(
  t: TestApp,
  a: { orgId: string; userId?: string | null; action: string; at?: string; details?: object },
) {
  const [row] = await t.admin(async (pg) =>
    (
      await pg.query(
        `insert into activities (organization_id, user_id, action, details, created_at) values ($1, $2, $3, $4::jsonb, coalesce($5::timestamptz, now())) returning id`,
        [a.orgId, a.userId ?? null, a.action, JSON.stringify(a.details ?? {}), a.at ?? null],
      )
    ).rows,
  );
  return (row as { id: string }).id;
}
