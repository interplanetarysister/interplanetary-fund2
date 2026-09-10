import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MailOpen } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import InboxItemCard from "@/components/inbox/InboxItemCard";
import { platformName } from "@/components/connections/platformCatalog";
import PageError from "@/components/PageError";

const SAFE_INBOX_ERROR = "We couldn't load your inbox. Please try again.";
const MAX_TEXT = 500;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const boundedText = (value) => typeof value === "string" ? value.slice(0, MAX_TEXT) : "";
const isFiniteAmount = (value) => typeof value === "number" && Number.isFinite(value);
const normalizeRows = (value) => Array.isArray(value) ? value.filter(isRecord) : null;

export default function Inbox() {
  const [items, setItems] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("open");
  const [platform, setPlatform] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [search, setSearch] = useState("");
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    let cancelled = false;
    const canCommit = () => mountedRef.current && !cancelled && requestId === requestRef.current;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!isRecord(me) || typeof me.id !== "string" || !me.id) throw new Error("invalid-auth");
        const results = await Promise.all([
          base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 100),
          base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50),
          base44.entities.Campaign.filter({ created_by_id: me.id }),
        ]);
        const [inboxItems, notifications, myCampaigns] = results.map(normalizeRows);
        if (!inboxItems || !notifications || !myCampaigns) throw new Error("invalid-collection");

        const donationResults = await Promise.all(
          myCampaigns.filter((c) => typeof c.id === "string").map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))
        );
        const donationLists = donationResults.map((result) => {
          const data = isRecord(result?.data) ? result.data : null;
          const donations = normalizeRows(data?.donations);
          if (!donations) throw new Error("invalid-donations");
          return donations;
        });

        const merged = [
          ...inboxItems.filter((i) => typeof i.id === "string").map((i) => ({
            key: `i-${i.id}`, record_id: i.id, platform: boundedText(i.platform), type: boundedText(i.type), author: boundedText(i.author),
            content: boundedText(i.content), link: typeof i.link === "string" ? i.link : undefined, campaign_id: typeof i.campaign_id === "string" ? i.campaign_id : undefined,
            campaign_title: boundedText(i.campaign_title || myCampaigns.find((c) => c.id === i.campaign_id)?.title), status: boundedText(i.status), date: i.created_date, ai_draft: boundedText(i.ai_draft),
          })),
          ...donationLists.flat().filter((d) => typeof d.id === "string" && isFiniteAmount(d.amount)).map((d) => ({
            key: `d-${d.id}`, platform: "interplanetary", type: "donation", author: boundedText(d.donor_name) || "Anonymous",
            content: `Gave $${d.amount.toLocaleString()}${boundedText(d.message) ? ` — \"${boundedText(d.message)}\"` : ""}`,
            link: typeof d.campaign_id === "string" ? `/campaign/${d.campaign_id}` : undefined, campaign_id: typeof d.campaign_id === "string" ? d.campaign_id : undefined,
            campaign_title: boundedText(d.campaign_title), status: "done", date: d.created_date,
          })),
          ...notifications.filter((n) => typeof n.id === "string").map((n) => ({
            key: `n-${n.id}`, notification_id: n.id, platform: "interplanetary", type: n.type === "donation" ? "donation" : "system",
            author: "", content: `${boundedText(n.title)}${boundedText(n.body) ? ` — ${boundedText(n.body)}` : ""}`, link: typeof n.link === "string" ? n.link : undefined,
            status: n.read ? "done" : "open", date: n.created_date,
          })),
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        if (canCommit()) { setItems(merged); setError(null); }
      } catch (e) {
        if (canCommit()) setError(SAFE_INBOX_ERROR);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const retry = () => { setError(null); setRefreshKey((k) => k + 1); };
  if (error && !items) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={SAFE_INBOX_ERROR} onRetry={retry} /></div>;
  if (!items) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading inbox</span></div>;

  const platforms = [...new Set(items.map((i) => i.platform).filter(Boolean))];
  const campaigns = [...new Map(items.filter((i) => i.campaign_id && i.campaign_title).map((i) => [i.campaign_id, i.campaign_title])).entries()];
  const visible = items.filter((i) => (tab === "all" || i.status === tab) && (platform === "all" || i.platform === platform) && (campaignFilter === "all" || i.campaign_id === campaignFilter) && (!search || `${i.author} ${i.content} ${i.campaign_title || ""}`.toLowerCase().includes(search.toLowerCase())));

  return (
    <PullToRefresh onRefresh={retry} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {error ? <div className="mb-4" role="alert"><PageError message={SAFE_INBOX_ERROR} onRetry={retry} /></div> : null}
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center"><MailOpen className="w-5 h-5 text-white" /></span>Universal Inbox</h1>
      <p className="text-stone-500 mb-6">Every donation, comment, and alert from every connected platform — one communication center.</p>
      <div className="flex flex-wrap gap-3 mb-5">
        <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="open">Open</TabsTrigger><TabsTrigger value="done">Done</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
        <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All platforms</SelectItem>{platforms.map((p) => <SelectItem key={p} value={p}>{p === "interplanetary" ? "Interplanetary Fund" : platformName(p)}</SelectItem>)}</SelectContent></Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All campaigns</SelectItem>{campaigns.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}</SelectContent></Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="flex-1 min-w-40" />
      </div>
      {visible.length === 0 ? <p className="text-sm text-stone-400 text-center py-16">Nothing here — donations, comments, and alerts from your connected platforms will appear in this inbox.</p> : <div className="space-y-3">{visible.map((i) => <InboxItemCard key={i.key} item={i} onChanged={(u) => setItems((prev) => prev ? prev.map((x) => (x.key === u.key ? u : x)) : prev)} />)}</div>}
    </PullToRefresh>
  );
}
