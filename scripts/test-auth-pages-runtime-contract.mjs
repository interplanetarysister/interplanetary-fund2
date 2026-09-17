import assert from 'node:assert/strict';
import { getSafeAuthError } from '../src/lib/safe-auth-error.js';

const hostile = new Proxy({}, {
  get() {
    throw new Error('hostile getter should never be touched');
  },
  getOwnPropertyDescriptor() {
    throw new Error('hostile descriptor should never be touched');
  },
});

const fallbacks = [
  'Invalid email or password',
  'Registration failed',
  'Invalid verification code',
  'Failed to resend code',
  'Password reset failed',
];

for (const fallback of fallbacks) {
  assert.equal(getSafeAuthError(fallback), fallback);
}

for (const thrown of [new Error('raw'), 'raw', { message: 'raw' }, null, undefined, 0, false, hostile]) {
  assert.doesNotThrow(() => getSafeAuthError('Safe fallback', thrown));
  assert.equal(getSafeAuthError('Safe fallback', thrown), 'Safe fallback');
}

assert.equal(getSafeAuthError(), undefined);
console.log('auth-page runtime contract passed');
