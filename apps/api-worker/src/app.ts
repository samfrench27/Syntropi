import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { ApiError } from './http';
import type { AppDeps, AppEnv } from './types';
import { authRoutes } from './routes/auth';
import { usersRoutes as adminUsers } from './routes/admin/users';
import { organizationsRoutes as adminOrganizations } from './routes/admin/organizations';
import { apiKeysRoutes as adminApiKeys } from './routes/admin/apiKeys';
import { activitiesRoutes as adminActivities } from './routes/admin/activities';
import { providersRoutes as adminProviders } from './routes/admin/providers';
import { paymentsRoutes as adminPayments } from './routes/admin/payments';
import { billingRoutes as adminBilling } from './routes/admin/billing';
import { providerRequestsRoutes as adminProviderRequests } from './routes/admin/providerRequests';
import { apiKeysRoutes as clientApiKeys } from './routes/client/apiKeys';
import { organizationRoutes as clientOrganization } from './routes/client/organization';
import { activitiesRoutes as clientActivities } from './routes/client/activities';
import { billingRoutes as clientBilling } from './routes/client/billing';
import { providersRoutes as clientProviders } from './routes/client/providers';
import { usageRoutes as clientUsage } from './routes/client/usage';
import { banksRoutes } from './routes/banks';
import { paymentsRoutes } from './routes/payments';
import { webhooksRoutes } from './routes/webhooks';
import { stripeWebhookRoutes } from './routes/stripeWebhook';
import { mockBankRoutes } from './routes/mockBank';

export function buildApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  // How long the API itself took, so callers (and our load tests) can tell it apart from network time
  app.use('*', async (c, next) => {
    const started = performance.now();
    await next();
    c.res.headers.set('Server-Timing', `app;dur=${(performance.now() - started).toFixed(1)}`);
  });

  // An API is not for search results
  app.use('*', async (c, next) => {
    await next();
    c.res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  });

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => (deps.config.corsOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'X-API-Key'],
      maxAge: 600,
    }),
  );
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  app.get('/health', (c) => c.json({ status: 'ok', message: 'Server is running' }));
  app.get('/api/status', (c) =>
    c.json({ success: true, data: { status: 'operational', version: '1.0.0', timestamp: deps.now().toISOString() } }),
  );

  app.route('/api/auth', authRoutes);

  app.route('/api/admin/users', adminUsers);
  app.route('/api/admin/organizations', adminOrganizations);
  app.route('/api/admin/api-keys', adminApiKeys);
  app.route('/api/admin/activities', adminActivities);
  app.route('/api/admin/providers', adminProviders);
  app.route('/api/admin/payments', adminPayments);
  app.route('/api/admin/billing', adminBilling);
  app.route('/api/admin/provider-requests', adminProviderRequests);

  app.route('/api/client/api-keys', clientApiKeys);
  app.route('/api/client/organization', clientOrganization);
  app.route('/api/client/activities', clientActivities);
  app.route('/api/client/billing', clientBilling);
  app.route('/api/client/providers', clientProviders);
  app.route('/api/client/usage', clientUsage);

  app.route('/api/banks', banksRoutes);
  app.route('/api/payments', paymentsRoutes);
  app.route('/api/webhooks/stripe', stripeWebhookRoutes);
  app.route('/api/webhooks', webhooksRoutes);
  app.route('/api/mock-bank', mockBankRoutes);

  app.notFound((c) => c.json({ success: false, error: { message: 'Not found' } }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.details ? { details: err.details } : {}) } },
        err.status as 400,
      );
    }
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: { message: err.message } }, err.status);
    }
    // Anything else is a bug: log it for us, tell the caller nothing about it
    console.error(`Unhandled error on ${c.req.method} ${new URL(c.req.url).pathname}:`, err);
    return c.json({ success: false, error: { message: 'Internal Server Error' } }, 500);
  });

  return app;
}
