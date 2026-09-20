import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";

const SAFE_NOTIFICATION_ERROR = "Notifications are temporarily unavailable. Please try again.";
const MAX_NOTIFICATIONS = 20;
const MAX_ID_LENGTH = 160;

function isSafeNotificationRow(row) {
  return Boolean(
    row &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    row.id.length > 0 &&
    row.id.length <= MAX_ID_LENGTH &&
    (row.read === undefined || typeof row.read === "boolean")
  );
}

function normalizeNotifications(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const bounded = [];
  for (const row of value) {
    if (!isSafeNotificationRow(row) || seen.has(row.id)) continue;
    seen.add(row.id);
    bounded.push(row);
    if (bounded.length >= MAX_NOTIFICATIONS) break;
  }
  return bounded;
}

export default function NotificationBell() {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);

  const load = useCallback(async (uid) => {
    const requestGeneration = ++requestGenerationRef.current;
    try {
      const items = await base44.entities.Notification.filter({ user_id: uid }, "-created_date", MAX_NOTIFICATIONS);
      const normalized = normalizeNotifications(items);
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current || !normalized) return;
      setNotifications(normalized);
      setError(null);
    } catch {
      if (!mountedRef.current || requestGeneration !== requestGenerationRef.current) return;
      setError(SAFE_NOTIFICATION_ERROR);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    base44.auth.me().then((me) => {
      if (!mountedRef.current || !me?.id) return;
      setUserId(me.id);
      void load(me.id);
    }).catch(() => {
      if (mountedRef.current) setError(SAFE_NOTIFICATION_ERROR);
    });
    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!userId) return undefined;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (!mountedRef.current || event?.type !== "create" || event?.data?.user_id !== userId) return;
      const incoming = normalizeNotifications([event.data])?.[0];
      if (!incoming) return;
      setNotifications((prev) => {
        const withoutDuplicate = prev.filter((item) => item.id !== incoming.id);
        return [incoming, ...withoutDuplicate].slice(0, MAX_NOTIFICATIONS);
      });
      setError(null);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userId]);

  const unread = notifications.filter((n) => n && n.read !== true).length;

  return (
    <Link
      to="/notifications"
      className="relative p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      title={error || undefined}
    >
      <Bell className="w-5 h-5" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
