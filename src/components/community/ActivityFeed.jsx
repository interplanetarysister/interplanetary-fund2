import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import ActivityFeedCard from "./ActivityFeedCard";
import { Loader2 } from "lucide-react";
import PageError from "@/components/PageError";

const SAFE_FEED_ERROR = "We couldn't load the community activity feed.";

// Live Community activity feed. Loaded from the getCommunityFeed backend
// function, which applies server-side privacy filtering (guests see public
// events only) and returns sanitized display fields. Supports cursor
// pagination via "Load more". Works for both guests and signed-in users.
export default function ActivityFeed() {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const res = await base44.functions.invoke("getCommunityFeed", { limit: 20 });
      const data = res?.data;
      if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) {
        throw new Error("Malformed community feed response");
      }
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setItems(data.items);
      setCursor(typeof data.next_cursor === "string" && data.next_cursor.length > 0 ? data.next_cursor : null);
      setHasMore(typeof data.next_cursor === "string" && data.next_cursor.length > 0);
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(SAFE_FEED_ERROR);
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const res = await base44.functions.invoke("getCommunityFeed", { limit: 20, before: cursor });
      const data = res?.data;
      if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items)) return;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setItems((prev) => Array.isArray(prev) ? [...prev, ...data.items] : data.items);
      const nextCursor = typeof data.next_cursor === "string" && data.next_cursor.length > 0 ? data.next_cursor : null;
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } catch {
      // Keep existing items and cursor on pagination failure.
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoadingMore(false);
    }
  };

  if (error && (!items || items.length === 0)) {
    return <PageError message={error} onRetry={() => { setError(null); setItems(null); setRefreshKey((k) => k + 1); }} />;
  }
  if (!items) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-16">No activity yet — be the first to start a campaign or post an update!</p>;
  }
  return (
    <div>
      <div className="space-y-3">
        {items.map((e) => <ActivityFeedCard key={e.id} event={e} />)}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 min-h-[44px]">
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}