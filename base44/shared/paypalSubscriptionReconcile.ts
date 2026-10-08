import { getPayPalBillingSubscription, verifiedPayPalPlan, isPayPalSubscriptionId, IFUND_PAYPAL_ACCOUNT_REF } from './paypalSubscriptions.ts';
export async function reconcilePayPalSubscription(sr: any, subscriptionId: string, requiredUserId = '') {
  if (!isPayPalSubscriptionId(subscriptionId)) throw new Error('Invalid PayPal subscription identifier.');
  const subscription = await getPayPalBillingSubscription(subscriptionId);
  if (String(subscription?.id || '') !== subscriptionId) throw new Error('PayPal subscription lookup did not match.');
  const rows = await sr.entities.PayPalSubscriptionIntent.filter({ paypal_subscription_id: subscriptionId });
  const intent = (rows || []).find((row: any) => row.account_ref === IFUND_PAYPAL_ACCOUNT_REF &&
    row.plan_id === subscription.plan_id && row.custom_id === subscription.custom_id &&
    (!requiredUserId || row.user_id === requiredUserId));
  if (!intent) throw new Error('Subscription does not match an authorized IFund checkout.');
  const verified = await verifiedPayPalPlan(sr, intent.tier, intent.interval);
  if (!verified || verified.row.plan_id !== subscription.plan_id) throw new Error('PayPal subscription plan has changed or is not verified.');
  const user = await sr.entities.User.get(intent.user_id).catch(() => null);
  if (!user || user.role === 'admin') throw new Error('Subscription owner is not eligible.');
  const rawStatus = String(subscription.status || '').toUpperCase();
  const payment = subscription.billing_info?.last_payment;
  const paidCents = Math.round(Number(payment?.amount?.value) * 100);
  const hasVerifiedPayment = payment?.amount?.currency_code === 'USD' &&
    Number.isFinite(paidCents) && paidCents === verified.expected.amount_cents &&
    !!payment?.time && new Date(payment.time).getTime() >= new Date(intent.created_at).getTime() &&
    (!intent.last_reversal_at || new Date(payment.time).getTime() > new Date(intent.last_reversal_at).getTime());
  const failedPayments = Number(subscription.billing_info?.failed_payments_count || 0);
  // PayPal can report ACTIVE before the first payment settles. A recurring
  // approval alone cannot grant paid access. Also withhold access after a
  // failed/returned payment until a new provider-confirmed billing succeeds.
  const status = ['CANCELLED', 'EXPIRED'].includes(rawStatus) ? 'canceled' :
    rawStatus === 'SUSPENDED' || (rawStatus === 'ACTIVE' && (failedPayments > 0 || !!intent.last_reversal_at && !hasVerifiedPayment)) ? 'past_due' :
    rawStatus === 'ACTIVE' && hasVerifiedPayment ? 'active' : 'pending';
  const isCurrent = user.paypal_subscription_id === subscriptionId;
  if (status === 'active') {
    // Prevent an old unlinked PayPal subscription from overriding a new Stripe
    // or PayPal subscription.
    if (user.subscription_status === 'active' && user.subscription_provider &&
      user.subscription_provider !== 'paypal') throw new Error('An active subscription from another provider exists.');
    if (user.paypal_subscription_id && !isCurrent) throw new Error('A different PayPal subscription is already linked.');
    await sr.entities.User.update(user.id, {
      subscription_provider: 'paypal', paypal_subscription_id: subscriptionId,
      paypal_subscription_plan_id: subscription.plan_id,
      subscription_tier: intent.tier, subscription_interval: intent.interval,
      subscription_status: 'active',
      ...(subscription.billing_info?.next_billing_time ? { subscription_renews_at: subscription.billing_info.next_billing_time } : {}),
    });
  } else if (isCurrent && status !== 'pending') {
    await sr.entities.User.update(user.id, {
      subscription_status: status, ...(status === 'canceled' ? { subscription_tier: 'free', subscription_renews_at: null } : {}),
    });
  }
  await sr.entities.PayPalSubscriptionIntent.update(intent.id, {
    status, last_verified_at: new Date().toISOString(),
  });
  return { status, tier: intent.tier, interval: intent.interval, subscription_id: subscriptionId, owner_id: user.id };
}
