import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { PLANS } from "@/components/subscriptions/plans";
import { effectiveSubscription } from "@/lib/subscriptionEntitlements";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";

export default function Subscriptions() {
  const checkoutEnabled = useFeatureEnabled("subscription_checkout");
  const [user, setUser] = useState(null);
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [paypal, setPaypal] = useState({ plans: [], live_configured: false, webhook_configured: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const query = new URLSearchParams(window.location.search);
  const stripeReturned = query.get("subscribed") === "success";

  const refresh = useCallback(async () => {
    const [{ data }, currentUser] = await Promise.all([
      base44.functions.invoke("getPayPalSubscriptionOptions", {}).catch(() => ({ data: null })),
      base44.auth.me().catch(() => null),
    ]);
    if (data?.plans) setPaypal(data);
    if (currentUser) setUser(currentUser);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Unable to load subscription options."));
  }, [refresh]);

  useEffect(() => {
    if (query.get("paypal_checkout") !== "return") return;
    const id = query.get("subscription_id") || query.get("ba_token");
    if (!/^I-[A-Z0-9]{10,30}$/.test(id || "")) {
      setNotice("PayPal approval is being processed. Your plan is not active until PayPal confirms it.");
      return;
    }
    let cancelled = false;
    base44.functions.invoke("confirmPayPalSubscription", { subscription_id: id })
      .then(async ({ data }) => {
        if (cancelled) return;
        if (data?.verified) {
          setNotice("PayPal has confirmed your subscription. Your plan is now active.");
          await refresh();
        } else {
          setNotice("PayPal is processing your subscription. Your plan will activate after verification.");
        }
      })
      .catch(() => { if (!cancelled) setNotice("PayPal has not confirmed an active subscription yet. No paid access has been granted."); })
      .finally(() => {
        if (!cancelled) window.history.replaceState(null, "", "/subscriptions");
      });
    return () => { cancelled = true; };
    // Read a single returned subscription id once, not on repeated renders.
  }, []);

  const subscribe = async (plan, provider) => {
    if (!checkoutEnabled) { setError("New subscriptions are not available yet."); return; }
    if (window.self !== window.top) { setError("Open IFund in a full browser tab to subscribe."); return; }
    setError("");
    setNotice("");
    const interval = annual ? "annual" : "monthly";
    const price = plan[interval];
    if (provider === "stripe" && !price?.stripe_price_id) { setError("This Stripe price is not yet available."); return; }
    const paypalAvailable = paypal.plans.some(row => row.tier === plan.id && row.interval === interval && row.available);
    if (provider === "paypal" && !paypalAvailable) { setError("PayPal billing is not fully configured for this plan yet."); return; }
    setSubscribing(plan.id + ":" + provider);
    try {
      const { data } = provider === "paypal"
        ? await base44.functions.invoke("createPayPalSubscriptionCheckout", { tier: plan.id, interval, origin: window.location.origin })
        : await base44.functions.invoke("createSubscriptionCheckout", { tier: plan.id, interval, price_id: price.stripe_price_id, origin: window.location.origin });
      if (data?.url && /^https:\/\//.test(data.url)) {
        window.location.assign(data.url);
        return;
      }
      setError(data?.error || "Could not start checkout. Please try again.");
    } catch {
      setError("Could not start checkout. Check your billing setup or try again.");
    } finally {
      setSubscribing(null);
    }
  };

  const cancelPayPal = async () => {
    if (!window.confirm("Cancel this PayPal subscription? Your paid IFund plan will end when PayPal confirms cancellation.")) return;
    setError("");
    setSubscribing("cancel");
    try {
      const { data } = await base44.functions.invoke("cancelPayPalSubscription", {});
      if (data?.ok) {
        setNotice("PayPal confirmed that your subscription is canceled.");
        await refresh();
      } else {
        setNotice("Cancellation is being confirmed by PayPal. Check your status again shortly.");
      }
    } catch {
      setError("Cancellation was not confirmed. Check your PayPal account before trying again.");
    } finally {
      setSubscribing(null);
    }
  };

  const setupBusinessBilling = async () => {
    setError("");
    setNotice("");
    setProvisioning(true);
    try {
      const { data: catalog } = await base44.functions.invoke("syncPayPalSubscriptionCatalog", {});
      if (!catalog?.ok || catalog.prices?.length !== 10) throw new Error("PayPal product/price setup was not verified.");
      const { data: hook } = await base44.functions.invoke("setupPayPalSubscriptionWebhook", {});
      if (!hook?.webhook_registered) throw new Error("PayPal prices are saved; the live webhook still needs deployment and verification.");
      const { data: enabled } = await base44.functions.invoke("activateSubscriptionCheckout", {});
      if (!enabled?.enabled || enabled.matched_paypal_prices !== 10 || !enabled.webhook_verified) {
        throw new Error("PayPal plans and webhook must pass the final live readiness check before checkout is enabled.");
      }
      await refresh();
      setNotice("All five PayPal products, ten recurring prices and the billing webhook are verified. Subscription checkout is enabled.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch (e) {
      await refresh().catch(() => {});
      setError(e?.message || "PayPal business subscription setup is not complete.");
    } finally {
      setProvisioning(false);
    }
  };

  if (!user) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const subscription = effectiveSubscription(user);
  const current = subscription.plan;
  const active = subscription.active;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="text-center mb-8">
        <h1 className="flex items-center justify-center gap-2.5 font-display text-3xl sm:text-4xl text-stone-900 mb-2">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </span>
          AI Plans
        </h1>
        <p className="text-stone-500">Choose the AI assistant that matches your fundraising ambitions.</p>
      </div>
      {stripeReturned && <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 text-center">Thank you! Stripe is confirming your subscription.</div>}
      {query.get("paypal_checkout") === "cancel" && <p className="text-sm text-stone-600 text-center mb-4">PayPal checkout was canceled. No subscription was activated.</p>}
      {notice && <p role="status" className="text-sm text-emerald-800 text-center mb-4">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600 text-center mb-4">{error}</p>}
      {user.role === "admin" && (
        <div className="mb-6 border border-cyan-200 rounded-xl bg-cyan-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-stone-900">IFund business PayPal billing</p>
            <p className="text-sm text-stone-600">
              {paypal.plans.filter(row => row.available).length}/10 verified PayPal prices · {paypal.webhook_configured ? "Webhook registered" : "Webhook not registered"}
            </p>
          </div>
          <Button type="button" variant="outline" disabled={provisioning} onClick={setupBusinessBilling}>
            {provisioning && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {provisioning ? "Checking PayPal" : "Set up / verify PayPal plans"}
          </Button>
        </div>
      )}
      {active && current.id !== "free" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Your current plan</p>
            <p className="font-display text-lg text-stone-900">{current.name}</p>
            {user.subscription_provider === "paypal" && (
              <button type="button" onClick={cancelPayPal} disabled={subscribing !== null}
                className="mt-2 text-sm text-red-700 underline underline-offset-2 disabled:opacity-50">
                Cancel PayPal subscription
              </button>
            )}
          </div>
          <Badge variant="outline" className="capitalize border-primary/30 text-primary bg-white">{subscription.adminGranted ? "Admin · permanent" : subscription.status}</Badge>
        </div>
      )}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${!annual ? "text-stone-900" : "text-stone-400"}`}>Monthly</span>
        <button type="button" aria-label="Toggle annual billing" aria-pressed={annual} onClick={() => setAnnual(a => !a)} className={`w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-stone-300"}`}>
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-stone-900" : "text-stone-400"}`}>Annual <span className="text-xs text-emerald-600">save ~20%</span></span>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {PLANS.map(plan => {
          const interval = annual ? "annual" : "monthly";
          const price = plan[interval];
          const paypalAvailable = !!paypal.plans.find(row => row.tier === plan.id && row.interval === interval && row.available);
          const stripeAvailable = !!price?.stripe_price_id;
          const isCurrent = active && subscription.tier === plan.id;
          const existingPaid = active && !subscription.adminGranted;
          return (
            <div key={plan.id} className={`rounded-2xl border p-6 bg-white flex flex-col ${plan.featured ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-stone-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-xl text-stone-900">{plan.name}</h2>
                {plan.featured && <Badge className="bg-primary text-primary-foreground">Most popular</Badge>}
              </div>
              <p className="text-sm text-stone-500 mb-4">{plan.tagline}</p>
              <p className="mb-4">
                <span className="font-display text-3xl text-stone-900">${(price.amount / 100).toLocaleString()}</span>
                <span className="text-stone-500 text-sm">/{annual ? "year" : "month"}</span>
              </p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {subscription.adminGranted ? (
                <Button disabled className="rounded-xl bg-stone-100 text-stone-500">{isCurrent ? "Admin plan · included" : "Included with admin"}</Button>
              ) : isCurrent ? (
                <Button disabled className="rounded-xl bg-stone-100 text-stone-500">Current plan</Button>
              ) : existingPaid ? (
                <Button disabled variant="outline" className="rounded-xl">Manage your current plan before switching</Button>
              ) : (
                <div className="space-y-2">
                  {paypalAvailable && (
                    <Button onClick={() => subscribe(plan, "paypal")} disabled={!checkoutEnabled || subscribing !== null} className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
                      {subscribing === plan.id + ":paypal" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Subscribe with PayPal
                    </Button>
                  )}
                  {stripeAvailable && (
                    <Button variant={paypalAvailable ? "outline" : "default"} onClick={() => subscribe(plan, "stripe")} disabled={!checkoutEnabled || subscribing !== null} className="w-full rounded-xl">
                      {subscribing === plan.id + ":stripe" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Subscribe with card / Stripe
                    </Button>
                  )}
                  {!paypalAvailable && !stripeAvailable && <Button disabled className="w-full rounded-xl">Billing setup in progress</Button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500 mt-8">
        <ShieldCheck className="w-4 h-4" /> Secure recurring billing via PayPal or Stripe, when available. Prices in USD. Manage or cancel through your billing provider.
      </p>
    </div>
  );
}