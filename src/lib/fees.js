// Frontend copy of fee calculation functions. The canonical source lives at
// base44/shared/fees.js for backend functions; this copy keeps the frontend
// bundle clean (no cross-boundary imports from base44/). These are pure
// functions with no I/O — identical on client and server. Keep in sync.

export const PLATFORM_FEE_RATE = 0.03;
export const CONTRIBUTION_RATE = 0.10;
export const PROCESSING_RATE = 0.029;
export const PROCESSING_FIXED = 0.30;
export const PAYPAL_PROCESSING_RATE = 0.0349;
export const PAYPAL_PROCESSING_FIXED = 0.49;
export const PAYPAL_WALLET_PROCESSING_RATE = 0.0289;
export const PAYPAL_WALLET_PROCESSING_FIXED = 0.29;
export const MIN_DONATION = 1;

const toCents = (n) => Math.round((Number(n) || 0) * 100);
const fromCents = (c) => (Math.round(c) || 0) / 100;

export const round2 = (n) => fromCents(toCents(n));

export function validateDonationAmount(amount) {
  const a = Number(amount) || 0;
  if (!a || a <= 0) return { ok: false, error: 'Enter a positive donation amount.' };
  if (a < MIN_DONATION) return { ok: false, error: `The minimum donation is $${MIN_DONATION.toFixed(2)}.` };
  if (a > 1000000) return { ok: false, error: 'Donation amount is too large.' };
  return { ok: true };
}

export function computeContribution(amount, optedIn) {
  const a = toCents(amount);
  if (!optedIn || a <= 0) return 0;
  return fromCents(a * CONTRIBUTION_RATE);
}

export function recipientGift(amount, optedIn) {
  const a = toCents(amount);
  const c = toCents(computeContribution(amount, optedIn));
  return fromCents(Math.max(0, a - c));
}

export function giftOf(donation) {
  if (!donation) return 0;
  const a = toCents(donation.amount);
  const c = toCents(donation.platform_contribution);
  return fromCents(Math.max(0, a - c));
}

export function computeProcessingFee(total) {
  const t = toCents(total);
  if (t <= 0) return 0;
  const fixed = Math.round(PROCESSING_FIXED * 100);
  const donation = Math.max(0, Math.floor((t - fixed) / (1 + PROCESSING_RATE)));
  return fromCents(t - donation);
}

function feeFromTotal(total, rate, fixedDollars) {
  const t = toCents(total);
  if (t <= 0) return 0;
  const fixed = Math.round(fixedDollars * 100);
  const donation = Math.max(0, Math.floor((t - fixed) / (1 + rate)));
  return fromCents(t - donation);
}
export function computePayPalProcessingFee(total) { return feeFromTotal(total, PAYPAL_PROCESSING_RATE, PAYPAL_PROCESSING_FIXED); }
export function computePayPalWalletProcessingFee(total) { return feeFromTotal(total, PAYPAL_WALLET_PROCESSING_RATE, PAYPAL_WALLET_PROCESSING_FIXED); }

// Matches createPayPalOrder: charge includes estimated PayPal/Google Pay processing.
export function computePayPalBreakdown(total, optedIn, paymentChannel = "paypal") {
  const totalCharged = round2(Number(total) || 0);
  const processing = paymentChannel === "googlepay"
    ? computePayPalWalletProcessingFee(totalCharged)
    : computePayPalProcessingFee(totalCharged);
  const amount = round2(Math.max(0, totalCharged - processing));
  const contribution = computeContribution(amount, optedIn);
  const recipientGift = round2(Math.max(0, amount - contribution));
  const platformFee = computePlatformFee(amount, optedIn);
  const recipientNet = round2(Math.max(0, recipientGift - platformFee));
  return { totalCharged, processing, amount, contribution, recipientGift, platformFee, recipientNet };
}

export function computeChargeTotal(total) { return round2(Number(total) || 0); }

export function computePlatformFee(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  return fromCents(Math.max(0, Math.round(gift * PLATFORM_FEE_RATE)));
}

export function computeRecipientNet(amount, optedIn) {
  const gift = toCents(recipientGift(amount, optedIn));
  const fee = toCents(computePlatformFee(amount, optedIn));
  return fromCents(Math.max(0, gift - fee));
}

export function computeBreakdown(total, optedIn) {
  return computeProcessorBreakdown(total, optedIn, computeProcessingFee);
}

export function computeProcessorBreakdown(total, optedIn, processingFeeForTotal) {
  const totalCharged = round2(Number(total) || 0);
  const processing = round2(processingFeeForTotal(totalCharged));
  const a = round2(Math.max(0, totalCharged - processing));
  const contribution = computeContribution(a, optedIn);
  const gift = round2(a - contribution);
  const platformFee = computePlatformFee(a, optedIn);
  const recipientNet = round2(Math.max(0, gift - platformFee));
  return { amount: a, contribution, recipientGift: gift, processing, platformFee, recipientNet, totalCharged };
}

export function computePayPalWalletBreakdown(total, optedIn) {
  return computePayPalBreakdown(total, optedIn, "googlepay");
}

export function computeWithdrawal(giftsTotal) {
  const gross = round2(Number(giftsTotal) || 0);
  const fee = round2(gross * PLATFORM_FEE_RATE);
  const net = round2(Math.max(0, gross - fee));
  return { gross, fee, net };
}
