export const MIN_LENGTH: 12;
export const MAX_LENGTH: 72;

export type CheckId = 'length' | 'lowercase' | 'uppercase' | 'number' | 'common' | 'personal' | 'max';

export interface PasswordCheck {
  id: CheckId;
  label: string;
  met: boolean;
  applicable: boolean;
}

export interface PasswordContext {
  email?: string | null;
  names?: (string | null | undefined)[];
}

export interface PasswordResult {
  /** Only the checks that apply to this password (for a checklist). */
  checks: PasswordCheck[];
  /** 0 (nothing typed) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** '' when nothing is typed, otherwise Weak, Fair, Good or Strong. */
  label: '' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Every required check passes. */
  acceptable: boolean;
}

export function evaluatePassword(password: string, context?: PasswordContext): PasswordResult;
export function describeFailures(result: PasswordResult): string;
export function isCommon(password: string): boolean;
export function containsPersonalInfo(password: string, context?: PasswordContext): boolean;
