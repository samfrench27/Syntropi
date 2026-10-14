import type { BankListAdapter, ProviderBank } from './types';
import { cleanBankName, getJson, slugify } from './types';

interface TokenBank {
  id: string;
  bic?: string;
  name: string;
  logoUri?: string;
  openBankingStandard?: string;
  supportedLocalInstruments?: string[];
  supportsAccountList?: boolean;
  supportsAccountDetails?: boolean;
  supportsAccountBalance?: boolean;
  supportsTransactionList?: boolean;
  supportsTransactionDetails?: boolean;
  supportsSinglePayment?: boolean;
  supportsScheduledPayment?: boolean;
  supportsStandingOrder?: boolean;
  supportsFundsConfirmation?: boolean;
  rank?: number;
  scaMethods?: string[];
  bankGroup?: string;
}

interface TokenBankResponse {
  banks?: TokenBank[];
  paging?: { page?: number; perPage?: number; pageCount?: number };
}

const PAYMENT_METHODS: Record<string, string> = {
  FASTER_PAYMENTS: 'faster_payments',
  CHAPS: 'chaps',
  SEPA: 'sepa',
  SEPA_INSTANT: 'sepa_instant',
  SEPA_CREDIT_TRANSFER: 'sepa',
};

export const mapTokenPaymentMethods = (instruments: string[]): string[] =>
  [...new Set(instruments.map((i) => PAYMENT_METHODS[i] || i.toLowerCase()).filter(Boolean))];

/** gb-<name>, with business/commercial/corporate moved to a -business suffix. */
export function tokenFriendlyId(name: string): string {
  const slug = slugify(name);
  if (/business|commercial|corporate/i.test(name)) {
    const rest = slug.split('-').filter((p) => p !== 'business' && p !== 'commercial' && p !== 'corporate').join('-');
    return `gb-${rest}-business`;
  }
  return `gb-${slug}`;
}

const PER_PAGE = 200;
/** Bounds the number of outbound requests one sync can make. */
const MAX_PAGES = 10;

export const tokenAdapter: BankListAdapter = {
  code: 'token',
  unavailableReason: (env) => (!env.TOKEN_API_KEY || !env.TOKEN_API_BASE_URL ? 'TOKEN_API_KEY and TOKEN_API_BASE_URL are not configured' : null),

  async getBanks(deps) {
    const base = deps.env.TOKEN_API_BASE_URL!.replace(/\/+$/, '');
    const headers = { Authorization: `Basic ${deps.env.TOKEN_API_KEY}`, Accept: 'application/json' };
    const all: TokenBank[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await getJson<TokenBankResponse>(deps, `${base}/v2/banks?countries=GB&perPage=${PER_PAGE}&page=${page}`, headers, 'Token.io');
      all.push(...(body.banks ?? []));
      const pageCount = body.paging?.pageCount ?? 1;
      if (page >= pageCount || !(body.banks?.length)) break;
    }

    return all
      .filter((b) => b.id && cleanBankName(b.name))
      .map((b): ProviderBank => ({
        id: tokenFriendlyId(cleanBankName(b.name)),
        originalId: b.id,
        name: cleanBankName(b.name),
        country: 'GB',
        logoUrl: b.logoUri || undefined,
        supportedPaymentMethods: mapTokenPaymentMethods(b.supportedLocalInstruments || []),
        metadata: {
          bic: b.bic,
          openBankingStandard: b.openBankingStandard,
          bankGroup: b.bankGroup ? cleanBankName(b.bankGroup) : undefined,
          supportedFeatures: {
            accountList: !!b.supportsAccountList,
            accountDetails: !!b.supportsAccountDetails,
            accountBalance: !!b.supportsAccountBalance,
            transactionList: !!b.supportsTransactionList,
            transactionDetails: !!b.supportsTransactionDetails,
            singlePayment: !!b.supportsSinglePayment,
            scheduledPayment: !!b.supportsScheduledPayment,
            standingOrder: !!b.supportsStandingOrder,
            fundsConfirmation: !!b.supportsFundsConfirmation,
          },
          rank: b.rank,
          scaMethods: b.scaMethods,
          originalProviderId: b.id,
        },
      }));
  },
};
