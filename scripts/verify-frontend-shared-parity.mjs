import assert from 'node:assert/strict';
import * as backendFees from '../base44/shared/fees.js';
import * as frontendFees from '../src/lib/fees.js';
import * as backendPrelaunch from '../base44/shared/prelaunch.js';
import * as frontendPrelaunch from '../src/lib/prelaunch.js';

for (const name of [
  'PLATFORM_FEE_RATE', 'CONTRIBUTION_RATE', 'PROCESSING_RATE', 'PROCESSING_FIXED',
  'PAYPAL_PROCESSING_RATE', 'PAYPAL_PROCESSING_FIXED',
  'PAYPAL_WALLET_PROCESSING_RATE', 'PAYPAL_WALLET_PROCESSING_FIXED', 'MIN_DONATION',
]) {
  assert.equal(frontendFees[name], backendFees[name], `${name} must match the backend fee policy`);
}

const samples = [0, 0.01, 1, 33.33, 100, 250, 1_000_000];
for (const amount of samples) {
  assert.deepEqual(frontendFees.validateDonationAmount(amount), backendFees.validateDonationAmount(amount));
  assert.equal(frontendFees.computeProcessingFee(amount), backendFees.computeProcessingFee(amount));
  assert.equal(frontendFees.computePayPalProcessingFee(amount), backendFees.computePayPalProcessingFee(amount));
  assert.equal(frontendFees.computePayPalWalletProcessingFee(amount), backendFees.computePayPalWalletProcessingFee(amount));
  assert.deepEqual(frontendFees.computeWithdrawal(amount), backendFees.computeWithdrawal(amount));
  for (const optedIn of [false, true]) {
    assert.deepEqual(frontendFees.computeBreakdown(amount, optedIn), backendFees.computeBreakdown(amount, optedIn));
  }
}

for (const name of ['PRELAUNCH_MODE', 'PRELAUNCH_HEADLINE', 'PRELAUNCH_NOTICE', 'PRELAUNCH_PAYMENT_NOTICE']) {
  assert.equal(frontendPrelaunch[name], backendPrelaunch[name], `${name} must match the backend prelaunch policy`);
}

console.log('Frontend/backend fee and prelaunch policy parity verified.');
