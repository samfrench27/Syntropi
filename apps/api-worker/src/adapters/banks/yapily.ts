import type { BankListAdapter, ProviderBank } from './types';
import { cleanBankName, getJson, slugify } from './types';

interface YapilyInstitution {
  id: string;
  name: string;
  fullName?: string;
  countries?: { displayName?: string; countryCode2: string }[];
  environmentType?: string;
  credentialsType?: string;
  media?: { source: string; type: 'icon' | 'logo' }[];
  features?: string[];
}

const YAPILY_URL = 'https://api.yapily.com/institutions';

export function yapilyFeatures(f: string[]) {
  return {
    accountList: f.includes('ACCOUNTS') || f.includes('ACCOUNT'),
    accountDetails: f.includes('ACCOUNT'),
    accountBalance: f.includes('ACCOUNT_BALANCES'),
    transactionList: f.includes('ACCOUNT_TRANSACTIONS'),
    transactionDetails: f.includes('ACCOUNT_TRANSACTIONS'),
    singlePayment: f.includes('CREATE_DOMESTIC_SINGLE_PAYMENT') || f.includes('INITIATE_DOMESTIC_SINGLE_PAYMENT'),
    scheduledPayment: f.includes('CREATE_DOMESTIC_SCHEDULED_PAYMENT') || f.includes('INITIATE_DOMESTIC_SCHEDULED_PAYMENT'),
    standingOrder: f.includes('CREATE_DOMESTIC_PERIODIC_PAYMENT') || f.includes('INITIATE_DOMESTIC_PERIODIC_PAYMENT'),
    fundsConfirmation: f.includes('VARIABLE_RECURRING_PAYMENT_FUNDS_CONFIRMATION'),
  };
}

export function yapilyPaymentMethods(f: string[]): string[] {
  const methods: string[] = [];
  if (f.includes('CREATE_DOMESTIC_SINGLE_PAYMENT')) methods.push('faster_payments');
  if (f.includes('CREATE_INTERNATIONAL_SINGLE_PAYMENT')) methods.push('sepa', 'swift');
  if (methods.length === 0 && f.some((x) => x.includes('PAYMENT'))) methods.push('faster_payments');
  return methods;
}

export const yapilyAdapter: BankListAdapter = {
  code: 'yapily',
  unavailableReason: (env) => (!env.YAPILY_CLIENT_ID || !env.YAPILY_CLIENT_SECRET ? 'YAPILY_CLIENT_ID and YAPILY_CLIENT_SECRET are not configured' : null),

  async getBanks(deps) {
    const { YAPILY_CLIENT_ID: id, YAPILY_CLIENT_SECRET: secret } = deps.env;
    const auth = btoa(`${id}:${secret}`);
    const body = await getJson<{ data?: YapilyInstitution[] }>(deps, YAPILY_URL, { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, 'Yapily');

    return (body.data ?? [])
      // GB only. Sandbox institutions are never imported: the Worker has no development mode to opt in with.
      .filter((i) => i.id && (i.countries ?? []).some((c) => c.countryCode2 === 'GB') && i.environmentType !== 'SANDBOX')
      .map((i): ProviderBank => {
        const features = i.features ?? [];
        const logo = i.media?.find((m) => m.type === 'logo')?.source || i.media?.find((m) => m.type === 'icon')?.source;
        const name = cleanBankName(i.fullName || i.name);
        return {
          id: `gb-${slugify(i.name)}`,
          originalId: i.id,
          name,
          country: 'GB',
          logoUrl: logo,
          supportedPaymentMethods: yapilyPaymentMethods(features),
          metadata: {
            environmentType: i.environmentType,
            credentialsType: i.credentialsType,
            supportedFeatures: yapilyFeatures(features),
            allFeatures: features,
            originalProviderId: i.id,
          },
        };
      })
      .filter((b) => b.name && b.id !== 'gb-');
  },
};
