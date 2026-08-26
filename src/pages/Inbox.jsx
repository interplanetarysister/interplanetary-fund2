import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MailOpen } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import InboxItemCard from "@/components/inbox/InboxItemCard";
import { platformName } from "@/components/connections/platformCatalog";

// The Universal Inbox — one communication center aggregating connected-platform
// interactions (InboxItems, e.g. live Ko-fi gifts), Interplanetary Fund
// donations to your campaigns, and your notifications.
export default function Inbox() {
  const [items, setItems] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState("open");
  const [platform, setPlatform] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const [inboxItems, notifications, myCampaigns] = await Promise.all([
        base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 100),
        base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50),
        base44.entities.Campaign.filter({ created_by_id: me.id }),
      ]);
      const donationLists = await Promise.all(
        myCampaigns.map(async (campaign) => {
          const response = await base44.functions.invoke("getCampaignDonationView", {
            campaign_id: campaign.id,
            limit: 25,
          });
          if (response.data?.error) throw new Error(response.data.error);
          return response.data?.donations || [];
        })
      );

      const merged = [
        ...inboxItems.map((i) => ({
          key: `i-${i.id}`, record_id: i.id, platform: i.platform, type: i.type, author: i.author,
          content: i.content, link: i.link, campaign_id: i.campaign_id,
          campaign_title: i.campaign_title || myCampaigns.find((c) => c.id === i.campaign_id)?.title,
          status: i.status, date: i.created_date, ai_draft: i.ai_draft,
        })),
        ...donationLists.flat().map((d) => ({
          key: `d-${d.id}`, platform: "interplanetary", type: "donation", author: d.donor_name || "Anonymous",
          content: `Gave $${(d.amount || 0).toLocaleString()}${d.message ? ` — \"${d.message}\"` : ""}`,
          link: `/campaign/${d.campaign_id}`, campaign_id: d.campaign_id, campaign_title: d.campaign_title,
          status: "done", date: d.created_date,
        })),
        ...notifications.map((n) => ({
          key: `n-${n.id}`, notification_id: n.id, platform: "interplanetary", type: n.type === "donation" ? "donation" : "system",
          author: "", content: `${n.title}${n.body ? ` — ${n.body}` : ""}`, link: n.link,
          status: n.read ? "done" : "open", date: n.created_date,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setItems(merged);
    })();
  }, [refreshKey]);

  if (!items) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const platforms = [...new Set(items.map((i) => i.platform))];
  const campaigns = [...new Map(items.filter((i) => i.campaign_id && i.campaign_title).map((i) => [i.campaign_id, i.campaign_title])).entries()];

  const visible = items.filter((i) =>
    (tab === "all" || i.status === tab) &&
    (platform === "all" || i.platform === platform) &&
    (campaignFilter === "all" || i.campaign_id === campaignFilter) &&
    (!search || `${i.author} ${i.content} ${i.campaign_title || ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <MailOpen className="w-5 h-5 text-white" />
        </span>
        Universal Inbox
      </h1>
      <p className="text-stone-500 mb-6">Every donation, comment, and alert from every connected platform — one communication center.</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p} value={p}>{platformName(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map(([campaignId, title]) => <SelectItem key={campaignId} value={campaignId}>{title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full sm:w-[220px]" />
      </div>

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500">Nothing here yet.</div>
        ) : visible.map((item) => <InboxItemCard key={item.key} item={item} />)}
      </div>
    </PullToRefresh>
  );
}
