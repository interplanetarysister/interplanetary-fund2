import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import BrandLogo from '@/components/brand/BrandLogo';
import LegalFooter from '@/components/LegalFooter';
export default function FoundingMembers() {
  const [params] = useSearchParams();
  const [email,setEmail] = useState('');
  const [screen,setScreen] = useState('');
  const [interest,setInterest] = useState('both');
  const [marketing,setMarketing] = useState(false);
  const [consent,setConsent] = useState(false);
  const [status,setStatus] = useState('');
  const [referral,setReferral] = useState('');
  const [loading,setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault();if(loading) return;setLoading(true);setStatus('');
    try {
      const response = await base44.functions.invoke('joinFoundingWaitlist',{
        email,screen_name:screen,interest,marketing_opt_in:marketing,consent,
        ref:params.get('ref') || '',website:''
      });
      const data = response?.data || response;
      if (!data?.ok) throw Error(data?.error || 'Signup could not be saved.');
      setStatus(data.message || "You're on the list!");
      setReferral(data.referral_code || '');
    } catch(e) {setStatus(e?.response?.data?.error || e?.message || 'Please try again.');}
    finally {setLoading(false);}
  };
  const link = referral ? window.location.origin + '/founding-members?ref=' + encodeURIComponent(referral) : '';
  return <div className="ifund-public min-h-dvh bg-background text-foreground">
    <main className="mx-auto max-w-xl px-5 py-12 sm:py-20">
      <div className="mb-9 flex justify-center"><Link to="/" aria-label="Home"><BrandLogo size="sm" /></Link></div>
      <div className="rounded-3xl border border-cyan-500/30 bg-card p-6 sm:p-10 shadow-xl">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[.2em] text-cyan-500">Founding Members • Early access</p>
        <h1 className="text-center font-display text-3xl sm:text-4xl font-bold">What if you were here from the beginning?</h1>
        <p className="my-5 text-center text-muted-foreground">Join the free InterplanetaryFund founding community. Supporters can explore the platform; future campaign creators can request early access. Joining does not open a fundraising account or guarantee approval.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Email address <input aria-label="Email address" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-foreground" /></label>
          <label className="block text-sm font-medium">Screen name (optional) <input maxLength={50} value={screen} onChange={e=>setScreen(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-foreground" /></label>
          <label className="block text-sm font-medium">I want to… <select value={interest} onChange={e=>setInterest(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-foreground"><option value="both">Support and fundraise</option><option value="support">Support campaigns</option><option value="fundraise">Start a campaign</option></select></label>
          <label className="flex gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)} /> Send me optional news and launch announcements (I can unsubscribe).</label>
          <label className="flex gap-3 text-sm text-muted-foreground"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} /> I agree to have my details stored to manage my early-access request. Read our <Link to="/privacy" className="underline text-primary">Privacy Policy</Link>.</label>
          <button type="submit" disabled={loading||!consent} className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{loading?'Joining…':'Join the founding community'}</button>
        </form>
        {status && <div role="status" className="mt-5 rounded-xl border border-border bg-background p-4 text-center text-sm">{status}</div>}
        {link && <div className="mt-4 space-y-2"><label className="block text-sm">Your invite link <input aria-label="Invite link" className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm" readOnly value={link}/></label><button type="button" onClick={()=>navigator.clipboard?.writeText(link)} className="rounded-lg border border-border px-4 py-2 text-sm">Copy invite link</button></div>}
        <p className="mt-6 text-center text-xs text-muted-foreground">No payment needed. No donation guarantee. Existing members keep their accounts.</p>
      </div>
      <p className="mt-7 text-center text-sm"><Link className="underline" to="/">Back to InterplanetaryFund</Link></p>
    </main><LegalFooter />
  </div>;
}
