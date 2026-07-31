import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const load = useCallback(async (uid) => {
    const items = await base44.entities.Notification.filter({ user_id: uid }, "-created_date", 20);
    setNotifications(items);
  }, []);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setUserId(me.id);
      load(me.id);
    });
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create" && event.data?.user_id === userId) {
        setNotifications((prev) => [event.data, ...prev].slice(0, 20));
      }
    });
    return unsubscribe;
  }, [userId]);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await base44.entities.Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
  };

  const openItem = async (n) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await base44.entities.Notification.update(n.id, { read: true });
    }
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 text-stone-400 hover:text-stone-100 transition-colors" aria-label="Notifications">
          <Bell className="w-5 h-5" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <p className="font-semibold text-sm text-stone-900">Notifications</p>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:text-primary/80 font-medium">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-stone-50 hover:bg-stone-50 transition-colors ${!n.read ? "bg-primary/10" : ""}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{n.body}</p>}
                    <p className="text-[11px] text-stone-400 mt-1">
                      {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}