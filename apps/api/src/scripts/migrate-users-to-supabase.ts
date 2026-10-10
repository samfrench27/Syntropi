/**
 * One-off: create a Supabase identity for every Mongo user that does not have one yet.
 *
 *   npm run migrate:users-to-supabase -- --dry-run
 *   npm run migrate:users-to-supabase
 *   npm run migrate:users-to-supabase -- --no-email     (create identities but send no emails)
 *
 * bcrypt hashes cannot be imported into Supabase, so each user is emailed a link to set a new password.
 * Safe to re-run: users that already have a supabaseId are skipped.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { assertSupabaseConfigured, dashboardUrl, getSupabaseAdmin, getSupabaseAnon } from '../lib/supabase';

dotenv.config({ path: process.cwd() + '/.env.local' });

const dryRun = process.argv.includes('--dry-run');
const sendEmail = !process.argv.includes('--no-email');

async function findSupabaseIdByEmail(email: string): Promise<string | undefined> {
  const admin = getSupabaseAdmin().auth.admin;
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
  return undefined;
}

async function main() {
  assertSupabaseConfigured();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/syntropi');

  const users = await User.find({ $or: [{ supabaseId: { $exists: false } }, { supabaseId: null }] });
  console.log(`${dryRun ? '[dry run] ' : ''}${users.length} user(s) to migrate`);

  const summary = { created: 0, linked: 0, failed: 0 };

  for (const user of users) {
    const meta = {
      role: user.role,
      organization_id: String(user.organization),
      mongo_user_id: String(user._id),
    };
    if (dryRun) {
      console.log(`  would migrate ${user.email} (${user.role})`);
      continue;
    }
    try {
      let supabaseId: string | undefined;
      const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        app_metadata: meta,
      });
      if (data?.user) {
        supabaseId = data.user.id;
        summary.created++;
      } else if (error && /already|registered|exists/i.test(error.message)) {
        supabaseId = await findSupabaseIdByEmail(user.email);
        if (!supabaseId) throw new Error('exists in Supabase but could not be found');
        await getSupabaseAdmin().auth.admin.updateUserById(supabaseId, { app_metadata: meta });
        summary.linked++;
      } else {
        throw new Error(error?.message || 'unknown error');
      }

      user.supabaseId = supabaseId;
      await user.save();

      if (sendEmail) {
        const { error: resetError } = await getSupabaseAnon().auth.resetPasswordForEmail(user.email, {
          redirectTo: `${dashboardUrl()}/reset-password`,
        });
        if (resetError) console.warn(`  ${user.email}: migrated, but the reset email failed: ${resetError.message}`);
      }
      console.log(`  migrated ${user.email}`);
    } catch (error: any) {
      summary.failed++;
      console.error(`  FAILED ${user.email}: ${error.message}`);
    }
  }

  console.log(dryRun ? 'Dry run complete. Nothing was changed.' : `Done. created ${summary.created}, linked ${summary.linked}, failed ${summary.failed}`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
