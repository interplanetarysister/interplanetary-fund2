export async function releaseWithdrawalMirrors(sr, withdrawalId) {
  await Promise.all([
    sr.entities.Donation.updateMany(
      { withdrawal_id: withdrawalId },
      { $set: { withdrawal_id: '' } },
    ),
    sr.entities.HoldingLedgerEntry.updateMany(
      { withdrawal_id: withdrawalId, direction: 'in', state: 'settled' },
      { $set: { withdrawal_id: '' } },
    ),
  ]);
}

export async function claimWithdrawalMirrors(sr, { withdrawalId, donationIds, holdingIds }) {
  try {
    await sr.entities.Donation.updateMany(
      { id: { $in: donationIds }, withdrawal_id: { $in: [null, ''] } },
      { $set: { withdrawal_id: withdrawalId } },
    );
    await sr.entities.HoldingLedgerEntry.updateMany(
      { id: { $in: holdingIds }, withdrawal_id: { $in: [null, ''] }, direction: 'in', state: 'settled' },
      { $set: { withdrawal_id: withdrawalId } },
    );
  } catch (claimError) {
    try {
      await releaseWithdrawalMirrors(sr, withdrawalId);
    } catch (releaseError) {
      const error = new Error('Withdrawal mirror claim failed and rollback requires reconciliation.');
      error.releasePending = true;
      error.cause = { claimError, releaseError };
      throw error;
    }
    throw claimError;
  }
}
