import { Client, type IMessage } from "@stomp/stompjs";
import { API_BASE_URL } from "../api/http";
import { getAccessToken } from "../auth/accessToken";
import type { Notification } from "../types/notification";

type NotificationHandler = (notification: Notification) => void;

let client: Client | null = null;
let activeHandler: NotificationHandler | null = null;

function toWebSocketUrl(apiBaseUrl: string): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;

  const base = apiBaseUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}/ws`;
  if (base.startsWith("http://")) return `${base.replace("http://", "ws://")}/ws`;
  return `ws://${base}/ws`;
}

export function connectNotificationSocket(onNotification: NotificationHandler): () => void {
  activeHandler = onNotification;

  const token = getAccessToken();
  if (!token) {
    return () => {
      if (activeHandler === onNotification) activeHandler = null;
    };
  }

  if (client) {
    return () => {
      if (activeHandler === onNotification) activeHandler = null;
    };
  }

  client = new Client({
    brokerURL: toWebSocketUrl(API_BASE_URL),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 10000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      client?.subscribe("/user/queue/notifications", (message: IMessage) => {
        try {
          const notification = JSON.parse(message.body) as Notification;
          activeHandler?.(notification);
        } catch {
          // Ignore malformed socket payloads; REST remains the source of truth.
        }
      });
    },
    onStompError: () => {
      const current = client;
      client = null;
      current?.deactivate();
    },
    onWebSocketClose: () => {
      client = null;
    },
  });

  client.activate();

  return () => {
    if (activeHandler === onNotification) activeHandler = null;
    const current = client;
    client = null;
    current?.deactivate();
  };
}

export function disconnectNotificationSocket() {
  activeHandler = null;
  const current = client;
  client = null;
  current?.deactivate();
}
