import { mockAdapter } from './mock';
import { tokenAdapter } from './token';
import type { PaymentAdapter } from './types';

const adapters: Record<string, PaymentAdapter> = { mock: mockAdapter, token: tokenAdapter };

/** The adapter for a provider code, or undefined when payments are not supported through it. */
export const getPaymentAdapter = (code: string): PaymentAdapter | undefined => adapters[code];
export const supportedPaymentProviders = (): string[] => Object.keys(adapters);
export type { AdapterPayment, CreateOptions, CreateResult, PaymentAdapter, PaymentStatus, StatusResult } from './types';
export { TERMINAL_STATUSES } from './types';
