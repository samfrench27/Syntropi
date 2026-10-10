/**
 * Create the first platform admin (superadmin). There is no public endpoint for this.
 *
 *   npm run bootstrap:superadmin -- --email you@company.com --first Ada --last Lovelace
 *
 * Without --password the person is emailed an invite to set their own. Use --password only for
 * local development. If the email already has a Supabase account it is reused.
 */
import { adminAuth, arg, connect, loadEnv } from './_env.mjs';

const email = arg('email')?.trim().toLowerCase();
const first = arg('first');
const last = arg('last');
const password = arg('password');
if (!email || !first || !last) {
  console.error('Usage: npm run bootstrap:superadmin -- --email <addr> --first <name> --last <name> [--password <pw>]');
  process.exit(1);
}

const env = loadEnv();
const sql = connect(env);
const admin = adminAuth(env);

try {
  const [existing] = await sql`select id, email from profiles where role = 'superadmin' limit 1`;
  if (existing) {
    console.error(`A superadmin already exists (${existing.email}). Create more from the platform admin dashboard.`);
    process.exit(1);
  }

  const [org] = await sql`
    insert into organizations (name, contact_email, plan, status)
    values ('Syntropi Platform', ${email}, 'enterprise', 'active')
    returning id`;

  // Reuse an existing Supabase account for this email, otherwise create or invite one
  let authId;
  for (let page = 1; !authId && page < 20; page++) {
    const { data } = await admin.listUsers({ page, perPage: 200 });
    authId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  const meta = { role: 'superadmin', organization_id: org.id };
  if (authId) {
    const { error } = await admin.updateUserById(authId, { app_metadata: meta, ...(password ? { password } : {}) });
    if (error) throw new Error(error.message);
  } else if (password) {
    const { data, error } = await admin.createUser({ email, password, email_confirm: true, app_metadata: meta });
    if (error) throw new Error(error.message);
    authId = data.user.id;
  } else {
    const { data, error } = await admin.inviteUserByEmail(email, { redirectTo: `${env.DASHBOARD_URL || 'http://localhost:3000'}/reset-password` });
    if (error) throw new Error(error.message);
    authId = data.user.id;
    await admin.updateUserById(authId, { app_metadata: meta });
  }

  await sql.begin(async (tx) => {
    await tx`insert into profiles (id, email, first_name, last_name, role, organization_id, status, is_verified)
             values (${authId}, ${email}, ${first}, ${last}, 'superadmin', ${org.id}, 'active', true)`;
    await tx`update organizations set owner_id = ${authId} where id = ${org.id}`;
  });

  console.log(password ? `Superadmin ready: ${email}` : `Superadmin created: ${email}. An invite email was sent to set a password.`);
} catch (error) {
  console.error('Bootstrap failed:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
