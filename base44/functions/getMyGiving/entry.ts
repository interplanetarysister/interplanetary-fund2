import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Owner-scoped giving history. The browser never receives pending donations or
// provider/ledger internals and therefore cannot use client filtering as an
// authorization or financial-truth boundary.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.Donation.filter(
      { donor_user_id: user.id, payment_verified: true },
      '-created_date',
      1000,
    ) || [];

    const donations = rows
      .filter((d) => d.donor_user_id === user.id && d.payment_verified === true)
      .map((d) => ({
        id: d.id,
        campaign_id: d.campaign_id,
        campaign_title: d.campaign_title || '',
        amount: Number(d.amount || 0),
        donor_name: d.donor_name || 'Anonymous',
        is_recurring: !!d.is_recurring,
        recurring_status: d.recurring_status || (d.is_recurring ? 'active' : undefined),
        payment_method: d.payment_method || 'other',
        created_date: d.created_date,
      }));

    return Response.json({ donations });
  } catch (error) {
    console.error('getMyGiving error:', error?.message || error);
    return Response.json({ error: 'Unable to load giving history.' }, { status: 500 });
  }
}
