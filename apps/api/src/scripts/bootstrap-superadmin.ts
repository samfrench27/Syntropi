/**
 * Create the first platform admin (superadmin). Replaces the old public create-first-admin endpoint.
 *
 *   npm run bootstrap:superadmin -- --email you@company.com --first Ada --last Lovelace
 *
 * Without --password the user is emailed an invite to set their own. Use --password only for local development.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Organization } from '../models/organization.model';
import { assertSupabaseConfigured, createIdentity, deleteIdentity } from '../lib/supabase';

dotenv.config({ path: process.cwd() + '/.env.local' });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const firstName = arg('first');
  const lastName = arg('last');
  const password = arg('password');
  if (!email || !firstName || !lastName) {
    console.error('Usage: npm run bootstrap:superadmin -- --email <addr> --first <name> --last <name> [--password <pw>]');
    process.exit(1);
  }
  assertSupabaseConfigured();

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/syntropi');

  if (await User.exists({ role: 'superadmin' })) {
    console.error('A superadmin already exists. Create more from the platform admin dashboard.');
    process.exit(1);
  }
  if (await User.exists({ email })) {
    console.error('A user with that email already exists.');
    process.exit(1);
  }

  const organization =
    (await Organization.findOne({ name: 'Syntropi Platform' })) ||
    (await Organization.create({ name: 'Syntropi Platform', contactEmail: email, plan: 'enterprise', status: 'active' }));

  const user = await User.create({
    email,
    firstName,
    lastName,
    role: 'superadmin',
    organization: organization._id,
    status: 'active',
    isVerified: true,
  });

  try {
    const supabaseId = await createIdentity({
      email,
      password,
      meta: { role: 'superadmin', organization_id: String(organization._id), mongo_user_id: String(user._id) },
    });
    user.supabaseId = supabaseId;
    await user.save();
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  organization.ownerId = user._id as any;
  await organization.save();

  console.log(password ? `Superadmin created: ${email}` : `Superadmin created: ${email}. An invite email was sent to set a password.`);
}

main()
  .catch((error) => {
    console.error('Bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
