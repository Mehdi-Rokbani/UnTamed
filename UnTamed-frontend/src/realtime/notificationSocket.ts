import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { API_BASE_URL } from "../api/http";
import { getAccessToken } from "../auth/accessToken";
import type { Notification } from "../types/notification";

type NotificationHandler = (notification: Notification) => void;

let client: Client | null = null;
let clientToken: string | null = null;
let activating = false;
let subscription: StompSubscription | null = null;
let disconnectTimer: number | null = null;
const handlers = new Set<NotificationHandler>();

function debugNotificationSocket(message: string, detail?: unknown) {
  if (!import.meta.env.DEV) return;
  if (detail === undefined) {
    console.debug(message);
    return;
  }
  console.debug(message, detail);
}

function toWebSocketUrl(apiBaseUrl: string): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;

  const base = apiBaseUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}/ws`;
  if (base.startsWith("http://")) return `${base.replace("http://", "ws://")}/ws`;
  return `ws://${base}/ws`;
}

function clearDisconnectTimer() {
  if (disconnectTimer == null) return;
  window.clearTimeout(disconnectTimer);
  disconnectTimer = null;
}

function subscribeNotifications() {
  if (!client?.connected || subscription) return;

  subscription = client.subscribe("/user/queue/notifications", (message: IMessage) => {
    try {
      const notification = JSON.parse(message.body) as Notification;
      handlers.forEach((handler) => handler(notification));
    } catch {
      // Ignore malformed socket payloads; REST remains the source of truth.
    }
  });
}

function disconnectNow() {
  clearDisconnectTimer();
  subscription?.unsubscribe();
  subscription = null;

  const current = client;
  client = null;
  clientToken = null;
  activating = false;
  current?.deactivate();
}

function scheduleDisconnectIfIdle() {
  if (handlers.size > 0 || disconnectTimer != null) return;

  disconnectTimer = window.setTimeout(() => {
    if (handlers.size === 0) {
      disconnectNow();
    }
  }, 300);
}

function ensureClient(token: string) {
  if (client && clientToken === token) {
    debugNotificationSocket("notification ws: reusing existing client");
    if (!client.active && !activating) {
      activating = true;
      debugNotificationSocket("notification ws: activating client");
      client.activate();
    }
    return;
  }

  if (client && clientToken !== token) {
    disconnectNow();
  }

  const brokerURL = toWebSocketUrl(API_BASE_URL);
  clientToken = token;
  activating = true;
  debugNotificationSocket("notification ws: activating client");

  client = new Client({
    brokerURL,
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 10000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      activating = false;
      subscribeNotifications();
    },
    onStompError: () => {
      subscription = null;
    },
    onWebSocketClose: () => {
      activating = false;
      subscription = null;
    },
  });

  client.activate();
}

export function connectNotificationSocket(onNotification: NotificationHandler): () => void {
  clearDisconnectTimer();
  handlers.add(onNotification);

  const token = getAccessToken();
  if (token) {
    ensureClient(token);
    if (client?.connected) subscribeNotifications();
  }

  return () => {
    handlers.delete(onNotification);
    scheduleDisconnectIfIdle();
  };
}

export function disconnectNotificationSocket() {
  handlers.clear();
  disconnectNow();
}
