import type { BankListAdapter } from './types';
import { tokenAdapter } from './token';
import { yapilyAdapter } from './yapily';

export type { BankListAdapter, ProviderBank } from './types';

/** TrueLayer and Tink are stubs in the Express app too: they report no banks and are not built yet. */
const stub = (code: string): BankListAdapter => ({
  code,
  unavailableReason: () => `${code} bank sync is not implemented yet`,
  getBanks: async () => [],
});

export const bankAdapters: Record<string, BankListAdapter> = {
  token: tokenAdapter,
  yapily: yapilyAdapter,
  truelayer: stub('truelayer'),
  tink: stub('tink'),
};

export const SYNC_PROVIDERS = Object.keys(bankAdapters);
