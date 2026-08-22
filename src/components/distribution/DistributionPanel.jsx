import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Megaphone, Sparkles, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import DistributedPostCard from "./DistributedPostCard";
import { platformName } from "@/components/connections/platformCatalog";

// The AI Campaign Distribution Engine — generates platform-tailored content
// for every connected social AND crowdfunding destination, saves them as
// drafts, then lets the owner approve & broadcast all at once (direct-publish
// where an API exists, copy-to-post otherwise).
export default function DistributionPanel({ campaign }) {
  const [connections, setConnections] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const [conns, existing] = await Promise.all([
        base44.entities.PlatformConnection.filter({}),
        base44.entities.DistributedPost.filter({ campaign_id: campaign.id }, "-created_date", 30),
      ]);
      setConnections(conns);
      setSelected(conns.filter((c) => c.automation_mode !== "manual").map((c) => c.id));
      setPosts(existing);
    })();
  }, [campaign.id]);

  if (!connections) return null;

  const pending = posts.filter((p) =>
    ["pending_approval", "draft", "approved", "failed"].includes(p.status)
  );

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("generateDistributionContent", {
        campaign_id: campaign.id,
        connection_ids: selected,
      });
      if (data?.error) setError(data.error);
      else setPosts((prev) => [...(data.posts || []), ...prev]);
    } catch (e) {
      setError(e.response?.data?.error || "Generation failed. Please try again.");
    }
    setGenerating(false);
  };

  const broadcast = async () => {
    setBroadcasting(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("broadcastPosts", { campaign_id: campaign.id });
      if (data?.error) {
        setError(data.error);
      } else {
        const returned = data.posts || [];
        setPosts((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          for (const u of returned) map.set(u.id, u);
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
          );
        });
        toast({
          title: "Broadcast complete",
          description: `${data.published} published · ${data.manual} ready to post manually${data.failed ? ` · ${data.failed} failed` : ""}.`,
        });
      }
    } catch (e) {
      setError(e.response?.data?.error || "Broadcast failed. Please try again.");
    }
    setBroadcasting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1">
        <Megaphone className="w-5 h-5 text-primary" /> Distribution Engine
      </h3>
      <p className="text-sm text-stone-500 mb-4">
        AI writes a tailored post for each connected social and crowdfunding platform — never the same content twice. Review the drafts, then approve & broadcast.
      </p>

      {connections.length === 0 ? (
        <p className="text-sm text-stone-500">
          No platforms connected yet. <Link to="/connections" className="text-primary hover:underline">Connect your accounts</Link> to distribute this campaign.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            {connections.map((c) => (
              <label key={c.id} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-1.5 ${c.automation_mode === "manual" ? "opacity-50 border-stone-200 text-stone-400" : "border-stone-200 text-stone-700"}`}>
                <Checkbox
                  checked={selected.includes(c.id)}
                  disabled={c.automation_mode === "manual"}
                  onCheckedChange={(v) => setSelected((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                />
                {platformName(c.platform)}
                <span className="text-[10px] text-stone-400">{c.kind === "crowdfunding" ? "fundraiser" : "social"}</span>
                {c.automation_mode === "manual" && <span className="text-[10px]">(manual only)</span>}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button onClick={generate} disabled={generating || !selected.length} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate platform content
            </Button>
            {pending.length > 0 && (
              <Button onClick={broadcast} disabled={broadcasting} variant="outline" className="rounded-xl">
                {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Approve all & broadcast ({pending.length})
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        </>
      )}

      {posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((p) => (
            <DistributedPostCard
              key={p.id}
              post={p}
              onChanged={(u) => setPosts((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onRemoved={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}