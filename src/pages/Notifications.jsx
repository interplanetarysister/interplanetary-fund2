import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2, CheckCheck, ChevronRight } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { Button } from "@/components/ui/button";
import { contextualNotificationDestination } from "@/lib/actionDestinations";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  const mountedRef = useRef(true);

  const load = async () => {
    const generation = ++requestGeneration.current;
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("Malformed auth response");
      const mine = await base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50);
      if (!Array.isArray(mine)) throw new Error("Malformed notification response");
      if (!mountedRef.current || generation !== requestGeneration.current) return false;
      setUser(me);
      setItems(mine);
      setError("");
      return true;
    } catch (e) {
      console.error("Notifications load failed:", e?.name || "UnknownError");
      if (mountedRef.current && generation === requestGeneration.current) {
        setItems([]);
        setError("We couldn't load your notifications. Please try again.");
      }
      return false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      requestGeneration.current += 1;
    };
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    try {
      await base44.entities.Notification.updateMany({ user_id: user.id, read: false }, { $set: { read: true } });
      await load();
    } catch (e) {
      console.error("Mark notifications read failed:", e?.name || "UnknownError");
      if (mountedRef.current) setError("We couldn't update your notifications. Please try again.");
    }
  };

  const openItem = async (n) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await base44.entities.Notification.update(n.id, { read: true }).catch((e) => {
        console.error("Notification update failed:", e?.name || "UnknownError");
        if (mountedRef.current) setError("We couldn't update this notification. Please try again.");
      });
    }
    const destination = contextualNotificationDestination(n);
    if (destination) navigate(destination);
  };

  if (!items) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading notifications</span></div>;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <PullToRefresh onRefresh={load} className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-end justify-between mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </span>
          Notifications
        </h1>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error} <button type="button" onClick={() => { setItems(null); load(); }} className="font-semibold underline">Retry</button></div>}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">You're all caught up</p>
          <p className="text-sm text-stone-500">Notifications about donations, milestones, and AI alerts appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const destination = contextualNotificationDestination(n);
            const clickable = !!destination;
            const Card = clickable ? "button" : "div";
            return (
              <Card
                key={n.id}
                {...(clickable ? { onClick: () => openItem(n) } : {})}
                className={`w-full text-left flex gap-3 rounded-xl border p-4 transition-colors ${n.read ? "bg-white border-slate-200" : "bg-primary/10 border-primary/20"} ${clickable ? "hover:border-primary/40 cursor-pointer" : ""}`}
              >
                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                <div className={`flex-1 min-w-0 ${n.read ? "pl-2" : ""}`}>
                  <p className="font-medium text-stone-800 text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-stone-500">{n.body}</p>}
                </div>
                {clickable && (
                  <span className="text-xs text-primary font-semibold shrink-0 self-center flex items-center gap-1">
                    Open action <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PullToRefresh>
  );
}