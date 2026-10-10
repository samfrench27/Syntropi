import { beforeEach, describe, expect, it, vi } from 'vitest';

const signUp = vi.fn();
const deleteUser = vi.fn();
const updateUserById = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  getSupabaseAnon: () => ({ auth: { signUp } }),
  getSupabaseAdmin: () => ({ auth: { admin: { deleteUser, updateUserById } } }),
  setAppMetadata: (id: string, meta: unknown) => updateUserById(id, { app_metadata: meta }),
  dashboardUrl: () => 'http://localhost:3000',
}));
vi.mock('../src/models/user.model', () => ({
  User: { exists: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../src/models/organization.model', () => ({
  Organization: { create: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../src/models/activity.model', () => ({ Activity: { create: vi.fn().mockResolvedValue({}) } }));
vi.mock('../src/utils/logger', () => ({ winstonLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { User } from '../src/models/user.model';
import { Organization } from '../src/models/organization.model';
import { signup } from '../src/controllers/auth.controller';

const body = { email: 'New@Example.test', password: 'Passw0rdOK', firstName: 'Ada', lastName: 'Lovelace', companyName: 'Acme' };

async function run() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  await signup({ body, ip: '127.0.0.1', get: () => 'test' } as any, res, next);
  return { res, next };
}

const org = { _id: 'org-1', save: vi.fn() };
const user = { _id: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(User.exists).mockResolvedValue(null as any);
  vi.mocked(Organization.create).mockResolvedValue(org as any);
  vi.mocked(User.create).mockResolvedValue(user as any);
  vi.mocked(User.findByIdAndDelete).mockResolvedValue(null as any);
  vi.mocked(Organization.findByIdAndDelete).mockResolvedValue(null as any);
  signUp.mockResolvedValue({ data: { user: { id: 'sb-1', identities: [{ id: 'i' }] } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
});

describe('signup', () => {
  it('creates the org, the Supabase user and the profile, and sets trusted claims', async () => {
    const { res } = await run();
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.test' }));
    expect(Organization.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme' }));
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', supabaseId: 'sb-1' }));
    expect(updateUserById).toHaveBeenCalledWith('sb-1', {
      app_metadata: { role: 'admin', organization_id: 'org-1', mongo_user_id: 'user-1' },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('gives the same answer for an email that already has an account, and creates nothing', async () => {
    vi.mocked(User.exists).mockResolvedValue({ _id: 'x' } as any);
    const { res } = await run();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(signUp).not.toHaveBeenCalled();
    expect(Organization.create).not.toHaveBeenCalled();
  });

  it('gives the same answer when Supabase says the address is already registered', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'sb-1', identities: [] } }, error: null });
    const { res } = await run();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Organization.create).not.toHaveBeenCalled();
  });

  it('rolls everything back if creating the profile fails', async () => {
    vi.mocked(User.create).mockRejectedValue(new Error('db down'));
    const { next } = await run();
    expect(Organization.findByIdAndDelete).toHaveBeenCalledWith('org-1');
    expect(deleteUser).toHaveBeenCalledWith('sb-1');
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'db down' }));
  });

  it('rolls back the profile too if setting claims fails', async () => {
    updateUserById.mockRejectedValue(new Error('supabase down'));
    const { next } = await run();
    expect(User.findByIdAndDelete).toHaveBeenCalledWith('user-1');
    expect(Organization.findByIdAndDelete).toHaveBeenCalledWith('org-1');
    expect(deleteUser).toHaveBeenCalledWith('sb-1');
    expect(next).toHaveBeenCalled();
  });

  it('passes a Supabase signup error to the client as a 400', async () => {
    signUp.mockResolvedValue({ data: { user: null }, error: { message: 'Password too weak', status: 422 } });
    const { next } = await run();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(Organization.create).not.toHaveBeenCalled();
  });
});
