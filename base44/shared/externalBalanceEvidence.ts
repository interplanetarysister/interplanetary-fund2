export function externalBalanceEvidenceChanged({
  kind,
  existing,
  externalTotal,
  externalCurrency,
  externalDonorCount,
  reaffirmed = false,
}) {
  if (kind !== 'crowdfunding') return false;
  if (reaffirmed === true) return true;
  const priorTotal = Number(existing?.external_total ?? 0);
  const priorDonors = Number(existing?.external_donor_count ?? 0);
  const priorCurrency = String(existing?.external_currency || '').trim().toUpperCase();
  return Number(externalTotal) !== priorTotal ||
    Number(externalDonorCount) !== priorDonors ||
    String(externalCurrency || '').trim().toUpperCase() !== priorCurrency;
}
