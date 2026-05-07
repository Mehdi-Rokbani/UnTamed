import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth.store";
import * as NotificationApi from "../api/notification.api";
import { connectNotificationSocket, disconnectNotificationSocket } from "../realtime/notificationSocket";
import type { Notification } from "../types/notification";

type NotificationContextValue = {
  unreadCount: number;
  latest: Notification[];
  latestLoaded: boolean;
  latestLoading: boolean;
  latestError: string | null;
  realtimeAnnouncement: string | null;
  realtimeEventId: number;
  loadLatest: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  syncNotifications: (notifications: Notification[]) => void;
  markRead: (notification: Notification) => Promise<Notification>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: string, wasUnread?: boolean) => Promise<void>;
};

const NotificationsContext = createContext<NotificationContextValue | null>(null);
const LATEST_LIMIT = 20;

function notificationTime(notification: Notification): number {
  const time = new Date(notification.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function mergeNotifications(existing: Notification[], incoming: Notification[]): Notification[] {
  const byId = new Map<string, Notification>();

  for (const notification of existing) {
    byId.set(notification.id, notification);
  }

  for (const notification of incoming) {
    byId.set(notification.id, notification);
  }

  return Array.from(byId.values())
    .sort((a, b) => notificationTime(b) - notificationTime(a))
    .slice(0, LATEST_LIMIT);
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latest, setLatest] = useState<Notification[]>([]);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [realtimeAnnouncement, setRealtimeAnnouncement] = useState<string | null>(null);
  const [realtimeEventId, setRealtimeEventId] = useState(0);
  const mountedRef = useRef(true);
  const loadingLatestRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    const count = await NotificationApi.getUnreadNotificationCount();
    if (mountedRef.current) setUnreadCount(count);
  }, [user]);

  const loadLatest = useCallback(async () => {
    if (!user || loadingLatestRef.current) return;
    loadingLatestRef.current = true;
    setLatestLoading(true);
    setLatestError(null);
    try {
      const page = await NotificationApi.listNotifications(0, 10);
      if (!mountedRef.current) return;
      setLatest((items) => mergeNotifications(items, page.content ?? []));
      setLatestLoaded(true);
    } catch (e: any) {
      if (mountedRef.current) setLatestError(e?.message ?? "Could not load notifications.");
      throw e;
    } finally {
      loadingLatestRef.current = false;
      if (mountedRef.current) setLatestLoading(false);
    }
  }, [user]);

  const syncNotifications = useCallback((notifications: Notification[]) => {
    if (notifications.length === 0) return;
    setLatest((items) => mergeNotifications(items, notifications));
    setLatestLoaded(true);
  }, []);

  const upsertSocketNotification = useCallback((notification: Notification) => {
    setLatest((items) => {
      const existing = items.find((item) => item.id === notification.id);
      if (!existing && !notification.read) {
        setUnreadCount((count) => count + 1);
      }
      return mergeNotifications(items, [notification]);
    });
    setLatestLoaded(true);
  }, []);

  const markRead = useCallback(async (notification: Notification) => {
    if (notification.read) return notification;
    const updated = await NotificationApi.markNotificationRead(notification.id);
    setLatest((items) => items.map((item) => item.id === updated.id ? updated : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    return updated;
  }, []);

  const markAllRead = useCallback(async () => {
    await NotificationApi.markAllNotificationsRead();
    setUnreadCount(0);
    setLatest((items) => items.map((item) => ({ ...item, read: true, readAt: item.readAt ?? new Date().toISOString() })));
  }, []);

  const removeNotification = useCallback(async (id: string, wasUnread = false) => {
    await NotificationApi.deleteNotification(id);
    setLatest((items) => {
      const removed = items.find((item) => item.id === id);
      if ((removed && !removed.read) || (!removed && wasUnread)) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return items.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => {
    if (loading || !user) {
      setUnreadCount(0);
      setLatest([]);
      setLatestLoaded(false);
      setLatestError(null);
      setRealtimeAnnouncement(null);
      disconnectNotificationSocket();
      return;
    }

    let alive = true;
    refreshUnread().catch(() => undefined);
    loadLatest().catch(() => undefined);

    const disconnect = connectNotificationSocket((notification) => {
      if (!alive) return;
      upsertSocketNotification(notification);
      setRealtimeAnnouncement(`New notification: ${notification.title}`);
      setRealtimeEventId((id) => id + 1);
    });

    const pollId = window.setInterval(() => {
      refreshUnread().catch(() => undefined);
    }, 45000);

    return () => {
      alive = false;
      window.clearInterval(pollId);
      disconnect();
    };
  }, [loadLatest, loading, refreshUnread, upsertSocketNotification, user]);

  const value = useMemo<NotificationContextValue>(() => ({
    unreadCount,
    latest,
    latestLoaded,
    latestLoading,
    latestError,
    realtimeAnnouncement,
    realtimeEventId,
    loadLatest,
    refreshUnread,
    syncNotifications,
    markRead,
    markAllRead,
    removeNotification,
  }), [
    latest,
    latestError,
    latestLoaded,
    latestLoading,
    loadLatest,
    markAllRead,
    markRead,
    refreshUnread,
    removeNotification,
    realtimeAnnouncement,
    realtimeEventId,
    syncNotifications,
    unreadCount,
  ]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used within NotificationsProvider");
  return context;
}
