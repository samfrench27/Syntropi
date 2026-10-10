import { Hono } from 'hono';
import type { AppEnv } from '../../types';

// Ported area: see the plan (M2). Mounted in app.ts.
export const organizationRoutes = new Hono<AppEnv>();
