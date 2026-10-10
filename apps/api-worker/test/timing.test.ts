import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app';

describe('Server-Timing', () => {
  it('reports how long the API took on every response, including errors', async () => {
    const t = await createTestApp();
    for (const [path, expected] of [['/health', 200], ['/api/auth/me', 401], ['/api/nope', 404]] as const) {
      const res = await t.app.request(path);
      expect(res.status).toBe(expected);
      expect(res.headers.get('server-timing')).toMatch(/^app;dur=\d+(\.\d+)?$/);
    }
  });
});
