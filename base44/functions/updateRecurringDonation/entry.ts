import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ALLOWED = new Set(['active', 'paused', 'cancelled']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { donation_id, recurring_status } = await req.json();
    if (!donation_id || !ALLOWED.has(recurring_status)) {
      return Response.json({ error: 'Invalid recurring donation update.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const donation = await sr.entities.Donation.get(donation_id);
    if (!donation) return Response.json({ error: 'Donation not found.' }, { status: 404 });
    if (donation.donor_user_id !== user.id) {
      return Response.json({ error: 'You can only manage your own recurring donations.' }, { status: 403 });
    }
    if (!donation.is_recurring) {
      return Response.json({ error: 'This donation is not recurring.' }, { status: 400 });
    }

    await sr.entities.Donation.update(donation.id, { recurring_status });
    return Response.json({ ok: true, donation_id: donation.id, recurring_status });
  } catch (error) {
    console.error('updateRecurringDonation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
