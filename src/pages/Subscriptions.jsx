import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { PLANS, getPlan } from "@/components/subscriptions/plans";

export default function Subscriptions() {
  const [user, setUser] = useState(null);
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [error, setError] = useState("");
  const justSubscribed = new URLSearchParams(window.location.search).get("subscribed") === "success";

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const subscribe = async (plan) => {
    setError("");
    const price = annual ? plan.annual : plan.monthly;
    if (!price?.stripe_price_id) { setError("This plan isn't available for purchase yet."); return; }
    if (window.self !== window.top) { setError("Checkout only works from the published app. Open your app in a new tab to subscribe."); return; }
    setSubscribing(plan.id);
    try {
      const { data } = await base44.functions.invoke("createSubscriptionCheckout", {
        tier: plan.id,
        interval: annual ? "annual" : "monthly",
        price_id: price.stripe_price_id,
        origin: window.location.origin,
      });
      if (data?.url) { window.location.href = data.url; return; }
      setError("Couldn't start checkout. Please try again.");
    } catch (e) {
      setError("Couldn't start checkout. Please try again.");
    }
    setSubscribing(null);
  };

  if (!user) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const current = getPlan(user.subscription_tier);
  const active = user.subscription_status === "active" || user.subscription_status === "trialing";

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

      {justSubscribed && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 text-center">
          Thank you! Your subscription is activating — it may take a moment to reflect on your account.
        </div>
      )}
      {error && <p className="text-sm text-red-600 text-center mb-4">{error}</p>}

      {active && current.id !== "free" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-500">Your current plan</p>
            <p className="font-display text-lg text-stone-900">{current.name}</p>
          </div>
          <Badge variant="outline" className="capitalize border-primary/30 text-primary bg-white">{user.subscription_status}</Badge>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${!annual ? "text-stone-900" : "text-stone-400"}`}>Monthly</span>
        <button onClick={() => setAnnual((a) => !a)} className={`w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-stone-300"}`}>
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-stone-900" : "text-stone-400"}`}>Annual <span className="text-xs text-emerald-600">save ~20%</span></span>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {PLANS.map((plan) => {
          const price = annual ? plan.annual : plan.monthly;
          const available = !!price?.stripe_price_id;
          const isCurrent = active && user.subscription_tier === plan.id;
          return (
            <div key={plan.id} className={`rounded-2xl border p-6 bg-white flex flex-col ${plan.featured ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-stone-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-xl text-stone-900">{plan.name}</h2>
                {plan.featured && <Badge className="bg-primary text-primary-foreground">Most popular</Badge>}
              </div>
              <p className="text-sm text-stone-500 mb-4">{plan.tagline}</p>
              <p className="mb-4">
                {available ? (
                  <>
                    <span className="font-display text-3xl text-stone-900">${(price.amount / 100).toLocaleString()}</span>
                    <span className="text-stone-500 text-sm">/{annual ? "year" : "month"}</span>
                  </>
                ) : (
                  <span className="text-sm text-stone-400">Coming soon</span>
                )}
              </p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button disabled className="rounded-xl bg-stone-100 text-stone-500">Current plan</Button>
              ) : available ? (
                <Button onClick={() => subscribe(plan)} disabled={subscribing === plan.id} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
                  {subscribing === plan.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Subscribe {annual ? "yearly" : "monthly"}
                </Button>
              ) : (
                <Button disabled className="rounded-xl">Coming soon</Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400 mt-8">
        <ShieldCheck className="w-4 h-4" /> Secure billing via Stripe. Cancel anytime. Prices in USD.
      </p>
    </div>
  );
}