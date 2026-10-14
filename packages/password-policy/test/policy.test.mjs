import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePassword, describeFailures, isCommon, containsPersonalInfo, MIN_LENGTH, MAX_LENGTH } from '../index.mjs';

const ok = (pw, ctx) => evaluatePassword(pw, ctx).acceptable;
const failed = (pw, ctx) => evaluatePassword(pw, ctx).checks.filter((c) => !c.met).map((c) => c.id);

test('length: 11 characters is refused, 12 is accepted', () => {
  assert.equal(MIN_LENGTH, 12);
  assert.deepEqual(failed('Harbor-Lam1'), ['length']); // 11 characters
  assert.equal(ok('Harbor-Lamps1'), true); // 13
  assert.equal(ok('Harbor-Lamp1'), true); // exactly 12
});

test('needs a lowercase letter, an uppercase letter and a number', () => {
  assert.deepEqual(failed('HARBOR-LAMPS-77'), ['lowercase']);
  assert.deepEqual(failed('harbor-lamps-77'), ['uppercase']);
  assert.deepEqual(failed('Harbor-Lamps-Net'), ['number']);
});

test('no symbol is required', () => {
  assert.equal(ok('HarborLamps7788'), true);
});

test('refuses the most used passwords, however they are decorated', () => {
  for (const pw of ['Password1234', 'p@ssw0rd1234', 'PASSWORD123456', 'Qwerty123456', 'Welcome12345!', 'Letmein123456', 'Iloveyou12345', 'Syntropi12345', 'P@ssw0rd!!!!!']) {
    assert.equal(isCommon(pw), true, pw);
    assert.ok(failed(pw).includes('common'), pw);
  }
});

test('refuses runs, keyboard walks and repeats', () => {
  for (const pw of ['Abcdefghijkl1', 'Qwertyuiop12', 'Aaaaaaaaaaaa1', '1Qaz2wsx3edc4', 'Abababababab1', 'Zxcvbnm123456', 'Asdfghjkl1234', 'Abc123Abc123Abc123']) {
    assert.ok(failed(pw).includes('common'), pw);
  }
});

test('leaves alone a real password that merely contains a short run', () => {
  for (const pw of ['Harbor-Lamps-1234', 'Tr1cky-Qwerty-Lamp-9', 'Blue-Anchor-Abc-2024']) assert.equal(isCommon(pw), false, pw);
});

test('does not flag a long passphrase just because it contains a common word', () => {
  assert.equal(ok('My-password-is-a-long-sentence-7'), true);
  assert.equal(isCommon('correct horse battery Staple 7'), false);
});

test('refuses a password built from the email or names, only when they are supplied', () => {
  const ctx = { email: 'ada.lovelace@acme.test', names: ['Ada', 'Lovelace'] };
  assert.ok(failed('Lovelace-Harbor-77', ctx).includes('personal'));
  assert.ok(failed('Xx-ada.lovelace-Yy1', ctx).includes('personal'));
  assert.equal(ok('Lovelace-Harbor-77'), true); // fine when we do not know who they are
  assert.equal(containsPersonalInfo('Harbor-Lamps-77', ctx), false);
  assert.equal(ok('Harbor-Lamps-77', ctx), true);
});

test('very short names and email names are ignored', () => {
  assert.equal(containsPersonalInfo('Harbor-Lamps-77', { email: 'jo@x.test', names: ['Jo'] }), false);
});

test('allows exactly the maximum length and refuses one more', () => {
  assert.equal(MAX_LENGTH, 72);
  const base = 'Quiet-Harbor-Lamps-7-'.repeat(4); // not a short repeating unit, so not a pattern
  assert.equal(ok(base.slice(0, 72)), true);
  assert.ok(failed(base.slice(0, 73)).includes('max'));
});

test('handles unicode and empty input', () => {
  assert.equal(ok('Ünïcödé-Hårbør-77'), true);
  assert.equal(evaluatePassword('').acceptable, false);
  assert.equal(evaluatePassword(undefined).label, '');
});

test('strength is a guide that moves with length', () => {
  const at = (pw) => evaluatePassword(pw);
  assert.equal(at('').score, 0);
  assert.deepEqual([at('abc').score, at('abc').label], [0, 'Weak']);
  assert.deepEqual([at('Password1').score, at('Password1').label], [1, 'Weak']);
  assert.deepEqual([at('Harbor-Lamp1').score, at('Harbor-Lamp1').label], [2, 'Fair']);
  assert.deepEqual([at('Harbor-Lamps-71').score, at('Harbor-Lamps-71').label], [3, 'Good']);
  assert.deepEqual([at('Harbor-Lamps-Quietly-7').score, at('Harbor-Lamps-Quietly-7').label], [4, 'Strong']);
});

test('a long password made of few distinct characters is not rated strong', () => {
  const r = evaluatePassword('Aa1Aa1Aa1Aa1Aa1Aa1Aa1');
  assert.ok(r.score <= 2, `score ${r.score}`);
});

test('the checklist lists only the checks that apply, and the personal check only with context', () => {
  assert.deepEqual(evaluatePassword('x').checks.map((c) => c.id), ['length', 'lowercase', 'uppercase', 'number', 'common']);
  assert.ok(evaluatePassword('x', { email: 'a@b.test' }).checks.some((c) => c.id === 'personal'));
});

test('describeFailures says exactly what is missing', () => {
  assert.equal(describeFailures(evaluatePassword('Harbor-Lamps-77')), '');
  const msg = describeFailures(evaluatePassword('short'));
  assert.match(msg, /at least 12 characters/);
  assert.match(msg, /an uppercase letter|a uppercase letter/i);
  assert.match(msg, /a number/);
});
