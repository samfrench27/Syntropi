import { describeFailures, evaluatePassword, type PasswordContext } from '@repo/password-policy';
import { ApiError } from '../http';

/**
 * Refuse a weak password. The rules are the shared ones the dashboard shows as people type
 * (packages/password-policy), so a password the form accepts is a password the API accepts.
 * The failed check ids come back in `error.details` so a caller can show which rule was missed.
 */
export function assertStrongPassword(password: string, context: PasswordContext = {}): void {
  const result = evaluatePassword(password, context);
  if (result.acceptable) return;
  throw new ApiError(
    describeFailures(result) || 'That password is too weak.',
    400,
    'WEAK_PASSWORD',
    result.checks.filter((c) => !c.met).map((c) => c.id),
  );
}
