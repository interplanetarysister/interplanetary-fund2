import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import DistributedPostCard from "./DistributedPostCard";
import { platformName } from "@/components/connections/platformCatalog";

// The AI Campaign Distribution Engine — generates platform-tailored content
// for every connected social destination, then routes each post through the
// owner's authorization setting (auto / ask / draft / manual).
export default function DistributionPanel({ campaign }) {
  const [connections, setConnections] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const [conns, existing] = await Promise.all([
        base44.entities.PlatformConnection.filter({ kind: "social" }),
        base44.entities.DistributedPost.filter({ campaign_id: campaign.id }, "-created_date", 30),
      ]);
      setConnections(conns);
      setSelected(conns.filter((c) => c.automation_mode !== "manual").map((c) => c.id));
      setPosts(existing);
    })();
  }, [campaign.id]);

  if (!connections) return null;

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

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1">
        <Megaphone className="w-5 h-5 text-primary" /> Distribution Engine
      </h3>
      <p className="text-sm text-stone-500 mb-4">
        AI writes a tailored post for each connected platform — never the same content twice. You stay in control of what publishes.
      </p>

      {connections.length === 0 ? (
        <p className="text-sm text-stone-500">
          No social platforms connected yet. <Link to="/connections" className="text-primary hover:underline">Connect your accounts</Link> to distribute this campaign.
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
                {c.automation_mode === "manual" && <span className="text-[10px]">(manual only)</span>}
              </label>
            ))}
          </div>
          <Button onClick={generate} disabled={generating || !selected.length} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground mb-4">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate platform content
          </Button>
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