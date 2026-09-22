import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";

const SAFE_NOTIFICATION_ERROR = "Notifications are temporarily unavailable. Please try again.";
const MAX_NOTIFICATIONS = 20;
const MAX_ID_LENGTH = 160;

function readSafeProperty(row, key) {
  try {
    return row?.[key];
  } catch {
    return undefined;
  }
}

function isSafeNotificationRow(row) {
  if (!row || typeof row !== "object") return false;
  const id = readSafeProperty(row, "id");
  const read = readSafeProperty(row, "read");
  return Boolean(
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH &&
    (read === undefined || read === null || typeof read === "boolean")
  );
}

function normalizeNotifications(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const bounded = [];
  for (const row of value.slice(0, MAX_NOTIFICATIONS)) {
    if (!isSafeNotificationRow(row)) continue;
    const id = readSafeProperty(row, "id");
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    bounded.push(row);
    if (bounded.length >= MAX_NOTIFICATIONS) break;
  }
  return bounded;
}

export default function NotificationBell() {
  const statusId = `notification-bell-status-${useId().replace(/:/g, "")}`;
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);
  const mountedRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const authGenerationRef = useRef(0);

  const load = useCallback(async (uid, authGeneration) => {
    const requestGeneration = ++requestGenerationRef.current;
    try {
      const items = await base44.entities.Notification.filter({ user_id: uid }, "-created_date", MAX_NOTIFICATIONS);
      const normalized = normalizeNotifications(items);
      if (
        !mountedRef.current ||
        authGeneration !== authGenerationRef.current ||
        requestGeneration !== requestGenerationRef.current
      ) return;
      if (!normalized) {
        setError(SAFE_NOTIFICATION_ERROR);
        return;
      }
      setNotifications(normalized);
      setError(null);
    } catch {
      if (
        !mountedRef.current ||
        authGeneration !== authGenerationRef.current ||
        requestGeneration !== requestGenerationRef.current
      ) return;
      setError(SAFE_NOTIFICATION_ERROR);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const authGeneration = ++authGenerationRef.current;
    setUserId(null);
    setError(null);

    base44.auth.me().then((me) => {
      if (!mountedRef.current || authGeneration !== authGenerationRef.current || !me?.id) return;
      setUserId(me.id);
      void load(me.id, authGeneration);
    }).catch(() => {
      if (mountedRef.current && authGeneration === authGenerationRef.current) {
        setError(SAFE_NOTIFICATION_ERROR);
      }
    });

    return () => {
      mountedRef.current = false;
      authGenerationRef.current += 1;
      requestGenerationRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (!userId) return undefined;
    const subscriptionGeneration = authGenerationRef.current;
    let unsubscribe;
    try {
      unsubscribe = base44.entities.Notification.subscribe((event) => {
        if (
          !mountedRef.current ||
          subscriptionGeneration !== authGenerationRef.current ||
          readSafeProperty(event, "type") !== "create"
        ) return;
        const eventData = readSafeProperty(event, "data");
        const eventUserId = readSafeProperty(eventData, "user_id");
        if (eventUserId !== userId) return;
        const incoming = normalizeNotifications([eventData])?.[0];
        if (!incoming) return;
        const incomingId = readSafeProperty(incoming, "id");
        setNotifications((prev) => {
          const withoutDuplicate = prev.filter((item) => readSafeProperty(item, "id") !== incomingId);
          return [incoming, ...withoutDuplicate].slice(0, MAX_NOTIFICATIONS);
        });
        setError(null);
      });
    } catch {
      if (mountedRef.current && subscriptionGeneration === authGenerationRef.current) {
        setError(SAFE_NOTIFICATION_ERROR);
      }
    }
    return () => {
      if (typeof unsubscribe !== "function") return;
      try {
        unsubscribe();
      } catch {
        // Provider cleanup failures must not escape React teardown.
      }
    };
  }, [userId]);

  const unread = notifications.filter((notification) => readSafeProperty(notification, "read") !== true).length;

  return (
    <Link
      to="/notifications"
      className="relative p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      aria-describedby={error ? statusId : undefined}
    >
      <Bell className="w-5 h-5" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      {error && (
        <span id={statusId} role="status" aria-live="polite" className="sr-only">
          {error}
        </span>
      )}
    </Link>
  );
}
