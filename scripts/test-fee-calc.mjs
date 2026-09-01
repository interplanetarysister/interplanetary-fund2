// Automated tests for the donation fee model (base44/shared/fees.js).
// Pure runtime math — no network, no charges, no payouts.
import {
  computeContribution, recipientGift, computePlatformFee, computeRecipientNet,
  computeProcessingFee, computeBreakdown, computeWithdrawal, giftOf,
} from '../base44/shared/fees.js';

let failed = 0;
const eq = (name, actual, expected) => {
  if (Math.abs((Number(actual) || 0) - expected) > 0.000001) {
    console.error(`FAIL ${name}: expected ${expected}, got ${actual}`);
    failed++;
  } else {
    console.log(`ok  ${name}: ${actual}`);
  }
};

// --- Fee calculations, contribution OFF (default / unchecked) ---
eq('contribution off (100)', computeContribution(100, false), 0);
eq('gift off (100)', recipientGift(100, false), 100);
eq('platformFee off (100)', computePlatformFee(100, false), 3.00);
eq('recipientNet off (100)', computeRecipientNet(100, false), 97.00);

// --- Fee calculations, contribution ON (opt-in) ---
eq('contribution on (100)', computeContribution(100, true), 10);
eq('gift on (100)', recipientGift(100, true), 90);
eq('platformFee on (100)', computePlatformFee(100, true), 2.70);
eq('recipientNet on (100)', computeRecipientNet(100, true), 87.30);
eq('processing fee (100)', computeProcessingFee(100), 3.20);

// --- Optional contribution on/off edge cases ---
eq('contribution on (0)', computeContribution(0, true), 0);
eq('contribution off (250)', computeContribution(250, false), 0);
eq('contribution on (250)', computeContribution(250, true), 25);
eq('gift on (250)', recipientGift(250, true), 225);

// --- No stacked fees: the checkout projection must equal withdrawal reality ---
// The recipient net shown at checkout equals the net paid out at withdrawal for
// the same gift — proving fees are not applied twice (checkout + withdrawal).
for (const opt of [false, true]) {
  const bd = computeBreakdown(100, opt);
  const wd = computeWithdrawal(bd.recipientGift);
  eq(`no-stacked-fee checkout==withdrawal net (opt=${opt})`, bd.recipientNet, wd.net);
  eq(`no-stacked-fee gift==withdrawal gross (opt=${opt})`, bd.recipientGift, wd.gross);
}

// The total charged never exceeds the entered amount — the contribution is an
// allocation FROM the total, never added on top.
for (const opt of [false, true]) {
  const bd = computeBreakdown(100, opt);
  eq(`total charged == entered amount (opt=${opt})`, bd.amount, 100);
  eq(`recipient never charged more than entered (opt=${opt})`, bd.contribution + bd.recipientGift, 100);
}

// giftOf reads the recipient gift from a stored Donation record.
eq('giftOf record with contribution', giftOf({ amount: 100, platform_contribution: 10 }), 90);
eq('giftOf legacy record (no contribution)', giftOf({ amount: 100 }), 100);

if (failed) { console.error(`\n${failed} fee-calc test(s) failed.`); process.exit(1); }
console.log('\nAll fee-calc tests passed.');