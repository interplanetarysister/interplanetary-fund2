import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

const ALLOWED = new Set(['active', 'paused', 'cancelled']);
const STRIPE_TERMINAL = new Set(['canceled', 'incomplete_expired']);

function sanitizeError(error) {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  return message ? message.slice(0, 180) : 'Unable to update recurring donation.';
}

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
    if (!donation.stripe_subscription_id) {
      return Response.json({ error: 'This recurring donation is missing its Stripe subscription reference.' }, { status: 409 });
    }

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const subscription = await stripe.subscriptions.retrieve(donation.stripe_subscription_id);

    // Make retries safe when Stripe completed the transition but the local
    // write was interrupted. Terminal Stripe cancellation is already the
    // requested state and should reconcile the local record instead of
    // returning an error that leaves the two systems out of sync.
    if (subscription.status === 'canceled') {
      if (recurring_status !== 'cancelled') {
        return Response.json({ error: 'The Stripe subscription is already canceled.' }, { status: 409 });
      }
      await sr.entities.Donation.update(donation.id, { recurring_status: 'cancelled' });
      return Response.json({ ok: true, donation_id: donation.id, recurring_status: 'cancelled' });
    }

    if (subscription.status === 'incomplete_expired') {
      return Response.json({ error: 'The Stripe subscription is expired and cannot be resumed.' }, { status: 409 });
    }

    if (recurring_status === 'cancelled') {
      await stripe.subscriptions.cancel(donation.stripe_subscription_id);
    } else if (recurring_status === 'paused') {
      if (!subscription.pause_collection) {
        await stripe.subscriptions.update(donation.stripe_subscription_id, {
          pause_collection: { behavior: 'void' },
        });
      }
    } else if (recurring_status === 'active') {
      if (subscription.pause_collection) {
        await stripe.subscriptions.update(donation.stripe_subscription_id, {
          pause_collection: null,
        });
      }
    }

    await sr.entities.Donation.update(donation.id, { recurring_status });
    return Response.json({ ok: true, donation_id: donation.id, recurring_status });
  } catch (error) {
    console.error('updateRecurringDonation error:', error.message);
    return Response.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
