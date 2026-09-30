import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { Progress } from "@/components/ui/progress";
import { Loader2, Heart, Pin, Archive, Trash2, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import FollowPrefsDialog from "@/components/campaigns/FollowPrefsDialog";
import PageError from "@/components/PageError";

const SORTS = [
  { value: "newest", label: "Newest followed" },
  { value: "recently_updated", label: "Recently updated" },
  { value: "ending_soon", label: "Ending soon" },
  { value: "closest_to_goal", label: "Closest to goal" },
  { value: "recently_viewed", label: "Recently viewed" },
];

const SAFE_LOAD_ERROR = "We couldn't load your followed campaigns. Please try again.";
const SAFE_MUTATION_ERROR = "We couldn't save that change. Please try again.";

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeFollows(value) {
  if (!Array.isArray(value) || value.some((row) => !isRecord(row) || typeof row.id !== "string" || typeof row.campaign_id !== "string")) return null;
  return value;
}

function normalizeCampaigns(value) {
  if (!Array.isArray(value) || value.some((row) => !isRecord(row) || typeof row.id !== "string")) return null;
  return value;
}

export default function FollowedCampaigns() {
  const [follows, setFollows] = useState(null);
  const [campaigns, setCampaigns] = useState({});
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const generationRef = useRef(0);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    try {
      const me = await base44.auth.me();
      if (!isRecord(me) || typeof me.id !== "string") throw new Error("invalid-auth");
      const list = normalizeFollows(await base44.entities.FollowedCampaign.filter({ user_id: me.id }, "-created_date"));
      if (!list) throw new Error("invalid-follows");
      const fresh = normalizeCampaigns(await Promise.all(list.map((f) => base44.entities.Campaign.get(f.campaign_id))));
      if (!fresh) throw new Error("invalid-campaigns");
      if (!mountedRef.current || generation !== generationRef.current) return;
      const map = {};
      fresh.forEach((c) => { map[c.id] = c; });
      setFollows(list);
      setCampaigns(map);
      setError(null);
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setError(SAFE_LOAD_ERROR);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; generationRef.current += 1; };
  }, [load]);

  const categories = useMemo(() => [...new Set(follows?.map((f) => f.category).filter(Boolean))], [follows]);

  const visible = useMemo(() => {
    if (!follows) return [];
    const rows = follows
      .filter((f) => showArchived ? f.archived : !f.archived)
      .filter((f) => category === "all" || f.category === category)
      .filter((f) => !search || f.campaign_title?.toLowerCase().includes(search.toLowerCase()))
      .map((f) => ({ follow: f, campaign: campaigns[f.campaign_id] }));

    rows.sort((a, b) => {
      if (a.follow.pinned && !b.follow.pinned) return -1;
      if (!a.follow.pinned && b.follow.pinned) return 1;
      switch (sort) {
        case "recently_updated": return new Date(b.campaign?.updated_date || 0) - new Date(a.campaign?.updated_date || 0);
        case "ending_soon": {
          const ae = a.campaign?.end_date, be = b.campaign?.end_date;
          if (!ae && !be) return 0; if (!ae) return 1; if (!be) return -1;
          return new Date(ae) - new Date(be);
        }
        case "closest_to_goal": {
          const ap = (a.campaign?.raised_amount || 0) / (a.campaign?.goal_amount || 1);
          const bp = (b.campaign?.raised_amount || 0) / (b.campaign?.goal_amount || 1);
          return bp - ap;
        }
        case "recently_viewed": return new Date(b.follow.last_viewed || 0) - new Date(a.follow.last_viewed || 0);
        default: return new Date(b.follow.created_date) - new Date(a.follow.created_date);
      }
    });
    return rows;
  }, [follows, campaigns, sort, search, category, showArchived]);

  const runMutation = useCallback(async (follow, action) => {
    if (!follow?.id || pendingIds.has(follow.id)) return;
    const beforeRecord = follow;
    const optimistic = action === "unfollow"
      ? follows.filter((x) => x.id !== follow.id)
      : follows.map((x) => x.id === follow.id ? { ...x, [action]: !x[action] } : x);
    setPendingIds((prev) => new Set(prev).add(follow.id));
    setMutationError(null);
    setFollows(optimistic);
    try {
      if (action === "unfollow") await base44.entities.FollowedCampaign.delete(follow.id);
      else await base44.entities.FollowedCampaign.update(follow.id, { [action]: !follow[action] });
    } catch {
      if (mountedRef.current) {
        setFollows((current) => {
          const exists = current.some((x) => x.id === beforeRecord.id);
          if (action === "unfollow") return exists ? current : [...current, beforeRecord];
          return exists ? current.map((x) => x.id === beforeRecord.id ? beforeRecord : x) : [...current, beforeRecord];
        });
        setMutationError(SAFE_MUTATION_ERROR);
      }
    } finally {
      if (mountedRef.current) setPendingIds((prev) => { const nextPending = new Set(prev); nextPending.delete(follow.id); return nextPending; });
    }
  }, [follows, pendingIds]);

  const markViewed = useCallback((f) => {
    if (!f?.id || pendingIds.has(f.id) || !mountedRef.current) return;
    void base44.entities.FollowedCampaign.update(f.id, { last_viewed: new Date().toISOString() }).catch(() => {
      if (mountedRef.current) setMutationError(SAFE_MUTATION_ERROR);
    });
  }, [pendingIds]);

  if (error) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); void load(); }} /></div>;
  if (!follows) return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading followed campaigns</span></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center"><Heart className="w-5 h-5 text-white fill-white" /></span>Followed Campaigns</h1>
      <p className="text-stone-500 mb-6">The campaigns you care about — updates, milestones, and moments, in one place.</p>
      {mutationError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{mutationError}</div>}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>)}</SelectContent></Select>
        <div className="relative flex-1 min-w-40"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search followed…" className="pl-9" /></div>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)} className="rounded-lg"><Archive className="w-3.5 h-3.5" /> {showArchived ? "Archived" : "Active"}</Button>
      </div>
      {visible.length === 0 ? <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center"><p className="font-display text-lg text-stone-700 mb-1">No followed campaigns {showArchived ? "archived" : "yet"}.</p><p className="text-sm text-stone-500 mb-5">Tap the heart on any campaign to follow it.</p><Link to="/discover"><Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0">Discover campaigns</Button></Link></div> : <div className="space-y-3">{visible.map(({ follow, campaign: c }) => { const pct = c ? Math.min(100, ((c.raised_amount || 0) / c.goal_amount) * 100) : 0; const busy = pendingIds.has(follow.id); return <div key={follow.id} className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden ${follow.pinned ? "ring-1 ring-primary/30" : ""}`}>
        <div className="flex gap-4 p-4"><Link to={`/campaign/${follow.campaign_id}`} onClick={() => markViewed(follow)} className="shrink-0"><Image src={follow.cover_image_url || c?.cover_image_url} alt={follow.campaign_title} className="w-24 h-24 rounded-xl object-cover" /></Link><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link to={`/campaign/${follow.campaign_id}`} onClick={() => markViewed(follow)}><p className="font-display text-lg text-stone-900 hover:text-primary truncate">{follow.campaign_title}</p></Link><div className="flex flex-wrap items-center gap-2 mt-1">{follow.category && <Badge variant="secondary">{categoryLabels[follow.category] || follow.category}</Badge>}{follow.pinned && <Badge className="bg-primary/10 text-primary border-0"><Pin className="w-3 h-3 mr-1" />Pinned</Badge>}{follow.archived && <Badge variant="outline">Archived</Badge>}</div></div></div>{c && <div className="mt-2"><Progress value={pct} className="h-1.5" /><p className="text-xs text-stone-500 mt-1">${(c.raised_amount || 0).toLocaleString()} of ${(c.goal_amount || 0).toLocaleString()} · updated {formatDistanceToNow(new Date(c.updated_date), { addSuffix: true })}</p></div>}</div></div>
        <div className="flex flex-wrap gap-2 px-4 pb-4"><FollowPrefsDialog follow={follow} disabled={busy} onChanged={(u) => setFollows((prev) => prev.map((x) => x.id === u.id ? u : x))} /><Button size="sm" variant="outline" disabled={busy} onClick={() => runMutation(follow, "pinned")} className="rounded-lg"><Pin className="w-3.5 h-3.5" /> {follow.pinned ? "Unpin" : "Pin"}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => runMutation(follow, "archived")} className="rounded-lg"><Archive className="w-3.5 h-3.5" /> {follow.archived ? "Restore" : "Archive"}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => runMutation(follow, "unfollow")} className="rounded-lg text-red-600"><Trash2 className="w-3.5 h-3.5" /> Unfollow</Button></div>
      </div>; })}</div>}
    </div>
  );
}
