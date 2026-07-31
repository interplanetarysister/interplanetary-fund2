import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const mine = await base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50);
      setItems(mine);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    if (!user) return;
    await base44.entities.Notification.updateMany({ user_id: user.id, read: false }, { $set: { read: true } });
    load();
  };

  if (!items) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-end justify-between mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
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

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">You're all caught up</p>
          <p className="text-sm text-stone-500">Notifications about donations, milestones, and AI alerts appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex gap-3 rounded-xl border p-4 ${n.read ? "bg-white border-stone-200" : "bg-orange-50/50 border-orange-200"}`}
            >
              {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 shrink-0" />}
              <div className={n.read ? "pl-2" : ""}>
                <p className="font-medium text-stone-800 text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-stone-500">{n.body}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}