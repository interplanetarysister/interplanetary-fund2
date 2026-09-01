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

export const PLATFORM_FEE_RATE = 0.03;
export const CONTRIBUTION_RATE = 0.10;
export const PROCESSING_RATE = 0.029;
export const PROCESSING_FIXED = 0.30;

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

// Optional contribution allocated FROM the entered amount (never added on top).
export function computeContribution(amount, optedIn) {
  const a = Number(amount) || 0;
  if (!optedIn || a <= 0) return 0;
  return round2(a * CONTRIBUTION_RATE);
}

// The recipient's gift: the entered amount minus the optional contribution.
export function recipientGift(amount, optedIn) {
  return round2((Number(amount) || 0) - computeContribution(amount, optedIn));
}

// Per-donation gift from a stored Donation record (amount minus its contribution).
export function giftOf(donation) {
  if (!donation) return 0;
  return round2((Number(donation.amount) || 0) - (Number(donation.platform_contribution) || 0));
}

// One processing fee (the processor's). Informational — covered by the platform.
export function computeProcessingFee(amount) {
  const a = Number(amount) || 0;
  return round2(a * PROCESSING_RATE + PROCESSING_FIXED);
}

// 3% platform fee on the recipient's gift (deducted at payout).
export function computePlatformFee(amount, optedIn) {
  return round2(recipientGift(amount, optedIn) * PLATFORM_FEE_RATE);
}

// What the campaign actually receives, after the 3% platform fee.
export function computeRecipientNet(amount, optedIn) {
  return round2(recipientGift(amount, optedIn) - computePlatformFee(amount, optedIn));
}

// Full breakdown for the donor-facing UI.
export function computeBreakdown(amount, optedIn) {
  const a = round2(Number(amount) || 0);
  const contribution = computeContribution(a, optedIn);
  const gift = round2(a - contribution);
  const processing = computeProcessingFee(a);
  const platformFee = round2(gift * PLATFORM_FEE_RATE);
  const recipientNet = round2(gift - platformFee);
  return { amount: a, contribution, recipientGift: gift, processing, platformFee, recipientNet };
}

// Withdrawal math for a set of recipient gifts: the single 3% platform fee and
// net payout. No processing fee here — the processor already took its one fee
// at checkout, so deducting it again at payout would double-charge.
export function computeWithdrawal(giftsTotal) {
  const gross = round2(Number(giftsTotal) || 0);
  const fee = round2(gross * PLATFORM_FEE_RATE);
  const net = round2(gross - fee);
  return { gross, fee, net };
}