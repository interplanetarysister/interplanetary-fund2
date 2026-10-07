import { round2, computeContribution, validateDonationAmount } from './fees.js';

// Pure, independently testable settlement calculation. Provider-observed net
// always overrides the checkout fee ESTIMATE when PayPal includes it.
export function resolvePayPalCaptureAllocation({
  chargedAmount,
  quotedDonation,
  quotedFee,
  quotedContribution,
  providerReceivable = null,
  providerFee = null,
}) {
  const charge = round2(chargedAmount);
  const quote = round2(quotedDonation);
  const feeQuote = round2(quotedFee);
  if (!Number.isFinite(Number(chargedAmount)) || charge <= 0 ||
      !Number.isFinite(Number(quotedDonation)) || quote <= 0 ||
      !Number.isFinite(Number(quotedFee)) || feeQuote < 0 ||
      Math.abs(round2(quote + feeQuote) - charge) > 0.01) {
    return { ok: false, reason: 'order_mismatch' };
  }

  let amount = quote;
  let processingFee = feeQuote;
  let source = 'quote';
  const received = providerReceivable == null ? null : Number(providerReceivable);
  const actualFee = providerFee == null ? null : Number(providerFee);
  if (received !== null && Number.isFinite(received) && received >= 0 && received <= charge) {
    amount = round2(received);
    processingFee = round2(charge - amount);
    source = 'paypal_receivable';
  } else if (actualFee !== null && Number.isFinite(actualFee) && actualFee >= 0 && actualFee < charge) {
    processingFee = round2(actualFee);
    amount = round2(charge - processingFee);
    source = 'paypal_fee';
  }

  if (!validateDonationAmount(amount).ok) {
    return { ok: false, reason: 'amount_below_minimum' };
  }
  const platformContribution = Number(quotedContribution) > 0 ? computeContribution(amount, true) : 0;
  return { ok: true, amount, processingFee, platformContribution, source };
}
