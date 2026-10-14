// Only used when NEXT_PUBLIC_USE_MOCK_DATA=true (local design work without an API). All fictional.
import type { Bank, InitiateResult, PaymentSession } from '@/types/payment';

const session: PaymentSession = {
  paymentId: 'pay_demo',
  status: 'PENDING',
  amount: { value: '24.50', currency: 'GBP' },
  reference: 'Order 1042',
  toAccount: { accountName: 'Example Coffee Roasters Ltd' },
  merchant: { name: 'Example Coffee Roasters', redirectUri: 'https://merchant.example/return' },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
};

const banks: Bank[] = [
  { id: 'gb-national-bank-of-test', name: 'National Bank of Test' },
  { id: 'gb-financial-trust-test', name: 'Financial Trust Test' },
  { id: 'gb-demo-credit', name: 'Demo Credit Union' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi = {
  async getSession() {
    await wait(300);
    return { ...session };
  },
  async getBanks() {
    await wait(300);
    return banks;
  },
  async initiate(): Promise<InitiateResult> {
    await wait(300);
    return { paymentId: session.paymentId, status: 'AUTHORIZING', redirectUrl: 'https://example.com/mock-bank' };
  },
  async cancel() {
    await wait(200);
    return { ...session, status: 'CANCELLED' as const };
  },
};
