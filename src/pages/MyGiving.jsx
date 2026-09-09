import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/dashboard/StatCard";
import RecurringPlanCard from "@/components/giving/RecurringPlanCard";
import DonationRow from "@/components/giving/DonationRow";
import { DollarSign, Repeat, Flame, Loader2 } from "lucide-react";
import PageError from "@/components/PageError";

const SAFE_GIVING_ERROR = "We couldn't load your giving history right now. Please try again.";

export default function MyGiving() {
  const [donations, setDonations] = useState(null);
  const [error, setError] = useState(null);
  const requestGeneration = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError(null);
    try {
      const response = await base44.functions.invoke("getMyGiving", {});
      const nextDonations = response?.data?.donations;
      if (!Array.isArray(nextDonations)) {
        throw new Error("MALFORMED_GIVING_RESPONSE");
      }
      if (mounted.current && generation === requestGeneration.current) {
        setDonations(nextDonations);
        return true;
      }
      return false;
    } catch {
      if (mounted.current && generation === requestGeneration.current) {
        setError(SAFE_GIVING_ERROR);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, [load]);

  if (error) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setDonations(null); load(); }} /></div>;
  }
  if (!donations) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading your giving history</span></div>;
  }

  const lifetime = donations.reduce((s, d) => s + d.amount, 0);
  const campaignsSupported = new Set(donations.map((d) => d.campaign_id)).size;
  const recurring = donations.filter((d) => d.is_recurring);
  const monthlyActive = recurring.filter((d) => (d.recurring_status || "active") === "active").reduce((s, d) => s + d.amount, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">My Giving</h1>
      <p className="text-stone-500 mb-8">Your generosity, all in one place.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Lifetime Giving" value={`$${lifetime.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Monthly Giving" value={`$${monthlyActive.toLocaleString()}`} icon={Repeat} hint="active recurring gifts" />
        <StatCard label="Campaigns Supported" value={campaignsSupported} icon={Flame} />
      </div>

      {recurring.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-3">Recurring gifts</h2>
          <div className="space-y-3">
            {recurring.map((d) => <RecurringPlanCard key={d.id} donation={d} onChanged={load} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl text-stone-900 mb-3">Donation history</h2>
        <div className="bg-white rounded-2xl border border-stone-200/70 px-5 py-2 shadow-sm">
          {donations.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">No confirmed donations yet — find a cause on the Discover page.</p>
          ) : (
            donations.map((d) => <DonationRow key={d.id} donation={d} />)
          )}
        </div>
      </section>
    </div>
  );
}
