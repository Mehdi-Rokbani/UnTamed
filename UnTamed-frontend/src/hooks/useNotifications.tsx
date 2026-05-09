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
const LATEST_CACHE_MS = 30_000;
const UNREAD_COUNT_DEDUPE_MS = 2000;

function notificationTime(notification: Notification): number {
  const time = new Date(notification.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function mergeNotifications(existing: Notification[], incoming: Notification[]): Notification[] {
  const byId = new Map<string, Notification>();

  for (const notification of existing.filter((item) => item.type !== "CHAT_MESSAGE")) {
    byId.set(notification.id, notification);
  }

  for (const notification of incoming.filter((item) => item.type !== "CHAT_MESSAGE")) {
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
  const latestLoadedRef = useRef(false);
  const latestLoadedAtRef = useRef(0);
  const unreadLoadingRef = useRef(false);
  const unreadLoadedAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    if (unreadLoadingRef.current || now - unreadLoadedAtRef.current < UNREAD_COUNT_DEDUPE_MS) return;

    unreadLoadingRef.current = true;
    try {
      const count = await NotificationApi.getUnreadNotificationCount();
      unreadLoadedAtRef.current = Date.now();
      if (mountedRef.current) setUnreadCount(count);
    } finally {
      unreadLoadingRef.current = false;
    }
  }, [user?.id]);

  const loadLatest = useCallback(async () => {
    if (!user || loadingLatestRef.current) return;
    if (latestLoadedRef.current && Date.now() - latestLoadedAtRef.current < LATEST_CACHE_MS) return;

    loadingLatestRef.current = true;
    setLatestLoading(true);
    setLatestError(null);
    try {
      const page = await NotificationApi.listNotifications(0, 10);
      if (!mountedRef.current) return;
      setLatest((items) => mergeNotifications(items, page.content ?? []));
      setLatestLoaded(true);
      latestLoadedRef.current = true;
      latestLoadedAtRef.current = Date.now();
    } catch (e: any) {
      if (mountedRef.current) setLatestError(e?.message ?? "Could not load notifications.");
      throw e;
    } finally {
      loadingLatestRef.current = false;
      if (mountedRef.current) setLatestLoading(false);
    }
  }, [user?.id]);

  const syncNotifications = useCallback((notifications: Notification[]) => {
    if (notifications.length === 0) return;
    setLatest((items) => mergeNotifications(items, notifications));
    setLatestLoaded(true);
    latestLoadedRef.current = true;
    latestLoadedAtRef.current = Date.now();
  }, []);

  const upsertSocketNotification = useCallback((notification: Notification) => {
    if (notification.type === "CHAT_MESSAGE") return;
    setLatest((items) => {
      const existing = items.find((item) => item.id === notification.id);
      if (!existing && !notification.read) {
        setUnreadCount((count) => count + 1);
      }
      return mergeNotifications(items, [notification]);
    });
    setLatestLoaded(true);
    latestLoadedRef.current = true;
    latestLoadedAtRef.current = Date.now();
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
      latestLoadedRef.current = false;
      latestLoadedAtRef.current = 0;
      unreadLoadingRef.current = false;
      unreadLoadedAtRef.current = 0;
      disconnectNotificationSocket();
      return;
    }

    let alive = true;
    refreshUnread().catch(() => undefined);

    const disconnect = connectNotificationSocket((notification) => {
      if (!alive) return;
      upsertSocketNotification(notification);
      if (!notification.read && notification.type !== "CHAT_MESSAGE") {
        refreshUnread().catch(() => undefined);
      }
      setRealtimeAnnouncement(`New notification: ${notification.title}`);
      setRealtimeEventId((id) => id + 1);
    });

    return () => {
      alive = false;
      disconnect();
    };
  }, [loading, refreshUnread, upsertSocketNotification, user?.id]);

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
