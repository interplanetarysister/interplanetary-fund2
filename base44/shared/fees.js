// Single source of truth for the donation fee breakdown. Pure functions, no
// I/O — identical on client and server and safe to unit-test.
//
// APPROVED FEE POLICY (each fee applied in exactly one place — never double-charged):
//  - The donor's entered amount is the TOTAL CHARGED. The optional 10% platform
//    contribution is an ALLOCATION FROM that total (never added on top), directed
//    to the platform. The recipient's gift = amount − contribution.
//  - Exactly ONE processing fee (the payment processor's fee) — shown for
//    transparency, covered by the platform, NOT deducted from the recipient.
//  - 3% platform fee — deducted ONCE, at payout (withdrawal), from the
//    recipient's gift. Never at checkout.
//  - Recipient net = recipient gift − 3% platform fee. This matches the
//    withdrawal payout exactly, so the checkout projection never overstates
//    what the campaign actually receives.
//
// All money math is performed in integer minor units (cents) to avoid
// floating-point drift; results convert back to dollars with safe rounding.
// No function ever returns a negative gift, fee, or payout.

export const PLATFORM_FEE_RATE = 0.03;
export const CONTRIBUTION_RATE = 0.10;
export const PROCESSING_RATE = 0.029;
export const PROCESSING_FIXED = 0.30;

// Minimum donation: one dollar. Sub-dollar charges are rejected by most
// processors and cannot yield a meaningful recipient payout after fees.
export const MIN_DONATION = 1;

// Integer minor-unit (cents) helpers.
const toCents = (n) => Math.round((Number(n) || 0) * 100);
const fromCents = (c) => (Math.round(c) || 0) / 100;

export const round2 = (n) => fromCents(toCents(n));

// Validates a donor-entered amount before any payment is started. Returns
// { ok: true } or { ok: false, error }. Rejects zero/negative, sub-minimum,
// and amounts too large to charge.
export function validateDonationAmount(amount) {
  const a = Number(amount) || 0;
  if (!a || a <= 0) return { ok: false, error: 'Enter a positive donation amount.' };
  if (a < MIN_DONATION) return { ok: false, error: `The minimum donation is $${MIN_DONATION.toFixed(2)}.` };
  if (a > 1000000) return { ok: false, error: 'Donation amount is too large.' };
  return { ok: true };
}

// Optional contribution allocated FROM the entered amount (never added on top).
// Computed in cents so the donor's total is always exactly the amount entered.
export function computeContribution(amount, optedIn) {
  const a = toCents(amount);
  if (!optedIn || a <= 0) return 0;
  return fromCents(a * CONTRIBUTION_RATE);
}

// The recipient's gift: the entered amount minus the optional contribution.
// Never negative.
export function recipientGift(amount, optedIn) {
  const a = toCents(amount);
  const c = toCents(computeContribution(amount, optedIn));
  return fromCents(Math.max(0, a - c));
}

// Per-donation gift from a stored Donation record (amount minus its contribution).
export function giftOf(donation) {
  if (!donation) return 0;
  const a = toCents(donation.amount);
  const c = toCents(donation.platform_contribution);
  return fromCents(Math.max(0, a - c));
}

// One processing fee (the processor's). Informational — covered by the platform,
// never deducted from the recipient's payout.
export function computeProcessingFee(amount) {
  const a = toCents(amount);
  return fromCents(Math.round(a * PROCESSING_RATE) + PROCESSING_FIXED * 100);
}

// 3% platform fee on the recipient's gift (deducted at payout). Never negative.
export function computePlatformFee(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  return fromCents(Math.max(0, Math.round(gift * PLATFORM_FEE_RATE)));
}

// What the campaign actually receives, after the 3% platform fee. Never negative.
export function computeRecipientNet(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  const fee = toCents(computePlatformFee(amount, optedIn));
  return fromCents(Math.max(0, gift - fee));
}

// Full breakdown for the donor-facing UI.
export function computeBreakdown(amount, optedIn) {
  const a = round2(Number(amount) || 0);
  const contribution = computeContribution(a, optedIn);
  const gift = round2(a - contribution);
  const processing = computeProcessingFee(a);
  const platformFee = computePlatformFee(a, optedIn);
  const recipientNet = round2(Math.max(0, gift - platformFee));
  return { amount: a, contribution, recipientGift: gift, processing, platformFee, recipientNet };
}

// Withdrawal math for a set of recipient gifts: the single 3% platform fee and
// net payout. No processing fee here — the processor already took its one fee
// at checkout, so deducting it again at payout would double-charge. Never negative.
export function computeWithdrawal(giftsTotal) {
  const gross = round2(Number(giftsTotal) || 0);
  const fee = round2(gross * PLATFORM_FEE_RATE);
  const net = round2(Math.max(0, gross - fee));
  return { gross, fee, net };
}