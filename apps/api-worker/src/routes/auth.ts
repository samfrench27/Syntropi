import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, ok, validate, valid } from '../http';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { logActivity } from '../lib/activity';
import type { AppEnv } from '../types';

export const authRoutes = new Hono<AppEnv>();

// Current user, for any signed-in role
authRoutes.get('/me', authenticate, async (c) => {
  const { userId } = c.get('user');
  const [row] = await c.get('deps').db.query<any>(
    `select p.id, p.email, p.first_name, p.last_name, p.role, p.status, p.created_at,
            o.id as org_id, o.name as org_name, o.status as org_status, o.plan as org_plan
       from profiles p join organizations o on o.id = p.organization_id
      where p.id = $1`,
    [userId],
  );
  if (!row) throw new ApiError('User not found', 404);

  return ok(c, {
    user: {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      organizationId: row.org_id,
      organization: { id: row.org_id, name: row.org_name, status: row.org_status, plan: row.org_plan },
    },
  });
});

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, 'needs a lowercase letter')
    .regex(/[A-Z]/, 'needs an uppercase letter')
    .regex(/[0-9]/, 'needs a number'),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  companyName: z.string().trim().min(1).max(200),
});

/**
 * Public signup: creates the company, the sign-in identity and the profile. The new account has
 * no provider access, so it only gets the Mock bank.
 *
 * The answer is the same whether or not the email is already registered, so this endpoint can't
 * be used to find out who has an account.
 */
authRoutes.post(
  '/signup',
  rateLimit({ name: 'signup', limit: 10, windowSeconds: 3600 }),
  validate('json', signupSchema),
  async (c) => {
    const { identity, db, config } = c.get('deps');
    const body = valid<z.infer<typeof signupSchema>>(c, 'json');
    const email = body.email.toLowerCase();

    const respond = () => ok(c, { emailConfirmationRequired: true }, 'Check your email to confirm your account.', 201);

    if ((await db.query(`select 1 from profiles where lower(email) = $1`, [email])).length > 0) return respond();

    const created = await identity.signUp({
      email,
      password: body.password,
      redirectTo: `${config.dashboardUrl}/login`,
      data: { first_name: body.firstName, last_name: body.lastName },
    });
    if (created.alreadyRegistered) return respond();

    let organizationId: string | undefined;
    try {
      // The organization and profile are written together, so a failure leaves neither behind
      await db.tx(async (tx) => {
        const [org] = await tx.query<{ id: string }>(
          `insert into organizations (name, contact_email, plan, status) values ($1, $2, 'free', 'active') returning id`,
          [body.companyName, email],
        );
        organizationId = org.id;
        await tx.query(
          `insert into profiles (id, email, first_name, last_name, role, organization_id, status)
           values ($1, $2, $3, $4, 'admin', $5, 'active')`,
          [created.id, email, body.firstName, body.lastName, org.id],
        );
        await tx.query(`update organizations set owner_id = $1 where id = $2`, [created.id, org.id]);
      });

      await identity.setAppMetadata(created.id, { role: 'admin', organization_id: organizationId });
    } catch (error) {
      // Undo whatever was created so a failed signup leaves nothing behind
      if (organizationId) {
        await db.query(`delete from profiles where id = $1`, [created.id]).catch(() => undefined);
        await db.query(`delete from organizations where id = $1`, [organizationId]).catch(() => undefined);
      }
      await identity.deleteUser(created.id).catch(() => undefined);
      throw error;
    }

    await logActivity(c, { userId: created.id, organizationId: organizationId!, action: 'auth.signup', details: { organizationId } });
    return respond();
  },
);
