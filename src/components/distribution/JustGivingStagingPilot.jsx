import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, FlaskConical } from "lucide-react";

// This administrator-only staging pilot never creates live JustGiving fundraisers.
// The user explicitly supplies the registered charity and confirms eligibility.
export default function JustGivingStagingPilot({ campaign }) {
  const [readiness, setReadiness] = useState(null);
  const [charityId, setCharityId] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [activityType, setActivityType] = useState("OtherPersonalChallenge");
  const [eligible, setEligible] = useState(false);
  const [terms, setTerms] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    base44.functions.invoke("justGivingStagingPilot", { action: "readiness" })
      .then(({ data }) => { if (mounted) setReadiness(data || { ready: false }); })
      .catch(() => { if (mounted) setReadiness({ ready: false }); });
    return () => { mounted = false; };
  }, []);
  const run = async (action) => {
    setBusy(true); setError("");
    if (action === "preview") { setPreview(null); setResult(null); }
    try {
      const { data } = await base44.functions.invoke("justGivingStagingPilot", {
        action, campaign_id: campaign.id, charity_id: charityId, currency,
        activity_type: activityType,
        confirm_staging_creation: action === "create_staging",
        confirm_charity_eligibility: eligible,
        confirm_provider_terms: terms,
      });
      if (!data?.ok) throw new Error(data?.error || "JustGiving did not confirm this action.");
      if (action === "preview") setPreview(data);
      else setResult(data);
    } catch (e) {
      setError(e?.message || "The JustGiving staging operation was not completed.");
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="JustGiving staging pilot" className="mb-4 min-w-0 rounded-xl border border-violet-300 bg-violet-50 p-4 text-slate-900 space-y-3">
      <h4 className="flex gap-2 items-center font-semibold text-slate-900"><FlaskConical className="w-4 h-4"/> JustGiving — admin staging pilot</h4>
      <p className="text-sm text-slate-800">Test the official API that creates an unclaimed fundraising page for an eligible JustGiving charity. The owner must claim it on JustGiving. This does not publish a live fundraiser or move donations.</p>
      {readiness && <p className="text-xs font-medium text-slate-800">
        Provider setup: {readiness.ready ? "Staging credentials and permission switch available" : "Not configured — an IFund administrator must register a JustGiving developer AppID and enable staging writes securely. No live creation is available."}
      </p>}
      <label className="block text-sm font-medium" htmlFor="jg-charity-id">Registered JustGiving charity ID</label>
      <Input id="jg-charity-id" inputMode="numeric" value={charityId} onChange={e=>{setCharityId(e.target.value);setPreview(null);}} placeholder="Enter eligible charity's JustGiving ID" className="bg-white text-slate-900" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Staging page activity
          <select value={activityType} onChange={e=>{setActivityType(e.target.value);setPreview(null);}} className="mt-1 w-full min-h-11 rounded-md border border-slate-300 bg-white p-2 text-slate-900">
            <option value="OtherPersonalChallenge">Personal challenge</option>
            <option value="Walks">Walk</option>
            <option value="Cycling">Cycling</option>
            <option value="Swimming">Swimming</option>
            <option value="Treks">Trek</option>
            <option value="PersonalStreaming_Gaming">Streaming / gaming</option>
          </select>
        </label>
        <label className="text-sm font-medium">Goal's currency on JustGiving
          <select value={currency} onChange={e=>{setCurrency(e.target.value);setPreview(null);}} className="mt-1 w-full min-h-11 rounded-md border border-slate-300 bg-white p-2 text-slate-900">
            <option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="AUD">AUD</option><option value="CAD">CAD</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-700">The IFund goal amount is copied numerically into the currency you select. No conversion or exchange rate is calculated.</p>
      <Button type="button" variant="outline" disabled={busy||!charityId.trim()} onClick={()=>run("preview")}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : null} Preview staging page
      </Button>
      {preview && <div className="rounded-lg bg-white border border-violet-200 p-3 text-xs text-slate-900 space-y-1">
        <p className="font-semibold">Preview — no page created</p>
        <p>Title: {preview.page_title}</p><p>Goal: {preview.target_amount} {preview.currency}</p>
        <p>Charity: {preview.charity_id} · Activity: {preview.activity_type}</p>
        <p>URL name: {preview.page_short_name}</p>
      </div>}
      {preview && <div className="space-y-2">
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={eligible} onChange={e=>setEligible(e.target.checked)} className="mt-1"/> I have confirmed this charity is eligible on JustGiving and that this campaign is permitted to fundraise for it.</label>
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} className="mt-1"/> I have reviewed the JustGiving developer terms and explicitly authorize this one staging registration.</label>
        <Button type="button" disabled={busy||!readiness?.ready||!eligible||!terms} onClick={()=>run("create_staging")}>
          Create unclaimed page in JustGiving staging
        </Button>
      </div>}
      {result && <div className="rounded-lg bg-white border border-violet-200 p-3 space-y-2 text-sm">
        <p className="font-semibold">{result.duplicate ? "Previously created staging page" : "JustGiving confirmed a staging page"} — not live</p>
        {result.page_url && <a href={result.page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline break-all">Staging page <ExternalLink className="w-3 h-3"/></a>}
        {result.claim_url && <p><a href={result.claim_url} target="_blank" rel="noopener noreferrer" className="underline">Open the private claim link</a> (claim link shown once; save it securely)</p>}
        <p>{result.note || result.claim_link_note}</p>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
