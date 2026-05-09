import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { API_BASE_URL } from "../api/http";
import { getAccessToken } from "../auth/accessToken";
import type { ChatMessage, ChatRoomMembershipEvent, ChatRoomPreviewEvent, ChatTypingEvent } from "../types/chat";

type ChatMessageHandler = (message: ChatMessage) => void;
type ChatTypingHandler = (event: ChatTypingEvent) => void;
type ChatMembershipHandler = (event: ChatRoomMembershipEvent) => void;
type ChatPreviewHandler = (event: ChatRoomPreviewEvent) => void;
type ChatStatusHandler = (connected: boolean) => void;

type RoomSubscription = {
  handlers: Set<ChatMessageHandler>;
  typingHandlers: Set<ChatTypingHandler>;
  statusHandlers: Set<ChatStatusHandler>;
  stompSubscription: StompSubscription | null;
  typingSubscription: StompSubscription | null;
};

let client: Client | null = null;
let clientToken: string | null = null;
let activating = false;
let disconnectTimer: number | null = null;
const rooms = new Map<string, RoomSubscription>();
const membershipHandlers = new Set<ChatMembershipHandler>();
const previewHandlers = new Set<ChatPreviewHandler>();
let membershipSubscription: StompSubscription | null = null;
let previewSubscription: StompSubscription | null = null;

function debugChatSocket(message: string, detail?: unknown) {
  if (!import.meta.env.DEV) return;
  if (detail === undefined) {
    console.debug(message);
    return;
  }
  console.debug(message, detail);
}

function logChatPreview(message: string, detail?: unknown) {
  if (!import.meta.env.DEV) return;
  if (detail === undefined) {
    console.log(message);
    return;
  }
  console.log(message, detail);
}

function toWebSocketUrl(apiBaseUrl: string): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;

  const base = apiBaseUrl.replace(/\/$/, "");
  if (base.startsWith("https://")) return `${base.replace("https://", "wss://")}/ws`;
  if (base.startsWith("http://")) return `${base.replace("http://", "ws://")}/ws`;
  return `ws://${base}/ws`;
}

function notifyRoomStatus(roomId: string, connected: boolean) {
  rooms.get(roomId)?.statusHandlers.forEach((handler) => handler(connected));
}

function notifyAllStatus(connected: boolean) {
  rooms.forEach((room) => room.statusHandlers.forEach((handler) => handler(connected)));
}

function roomEntry(roomId: string) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      handlers: new Set(),
      typingHandlers: new Set(),
      statusHandlers: new Set(),
      stompSubscription: null,
      typingSubscription: null,
    };
    rooms.set(roomId, room);
  }
  return room;
}

function clearDisconnectTimer() {
  if (disconnectTimer == null) return;
  window.clearTimeout(disconnectTimer);
  disconnectTimer = null;
}

function subscribeRoomOnClient(roomId: string) {
  const room = rooms.get(roomId);
  if (!client?.connected || !room) return;

  if (!room.stompSubscription) {
    const destination = `/topic/chat/rooms/${roomId}`;
    room.stompSubscription = client.subscribe(destination, (frame: IMessage) => {
      try {
        const message = JSON.parse(frame.body) as ChatMessage;
        debugChatSocket("chat ws received", message.id ?? frame.body);
        rooms.get(roomId)?.handlers.forEach((handler) => handler(message));
      } catch {
        // REST history remains the source of truth if a realtime payload is malformed.
      }
    });
    debugChatSocket("chat ws subscribed", { roomId, destination });
  }

  if (!room.typingSubscription) {
    const typingDestination = `/topic/chat/rooms/${roomId}/typing`;
    room.typingSubscription = client.subscribe(typingDestination, (frame: IMessage) => {
      try {
        const event = JSON.parse(frame.body) as ChatTypingEvent;
        debugChatSocket("chat typing received", event.userId ?? frame.body);
        rooms.get(roomId)?.typingHandlers.forEach((handler) => handler(event));
      } catch {
        // Typing is transient; malformed payloads can be ignored silently.
      }
    });
    debugChatSocket("chat typing subscribed", { roomId, destination: typingDestination });
  }

  notifyRoomStatus(roomId, true);
}

function subscribeAllRooms() {
  rooms.forEach((_, roomId) => subscribeRoomOnClient(roomId));
  subscribeMembershipOnClient();
  subscribePreviewOnClient();
}

function subscribeMembershipOnClient() {
  if (!client?.connected || membershipSubscription || membershipHandlers.size === 0) return;

  membershipSubscription = client.subscribe("/user/queue/chat-membership", (frame: IMessage) => {
    try {
      const event = JSON.parse(frame.body) as ChatRoomMembershipEvent;
      debugChatSocket("chat membership received", event.roomId ?? frame.body);
      membershipHandlers.forEach((handler) => handler(event));
    } catch {
      // Membership events are hints; REST access remains authoritative.
    }
  });
  debugChatSocket("chat membership subscribed");
}

function subscribePreviewOnClient() {
  if (!client?.connected || previewSubscription || previewHandlers.size === 0) return;

  previewSubscription = client.subscribe("/user/queue/chat-room-previews", (frame: IMessage) => {
    logChatPreview("[CHAT_PREVIEW_RECEIVED]", frame.body);
    try {
      const event = JSON.parse(frame.body) as ChatRoomPreviewEvent;
      debugChatSocket("chat room preview received", event.roomId ?? frame.body);
      previewHandlers.forEach((handler) => handler(event));
    } catch {
      // REST chat room list remains the source of truth if a preview is malformed.
    }
  });
  logChatPreview("[CHAT_PREVIEW_SUBSCRIBE] /user/queue/chat-room-previews");
  debugChatSocket("chat room preview subscribed");
}

function disconnectNow() {
  clearDisconnectTimer();
  rooms.forEach((room) => {
    room.stompSubscription?.unsubscribe();
    room.typingSubscription?.unsubscribe();
    room.stompSubscription = null;
    room.typingSubscription = null;
  });
  membershipSubscription?.unsubscribe();
  previewSubscription?.unsubscribe();
  membershipSubscription = null;
  previewSubscription = null;

  const current = client;
  client = null;
  clientToken = null;
  activating = false;
  current?.deactivate();
  notifyAllStatus(false);
}

function scheduleDisconnectIfIdle() {
  if (rooms.size > 0 || membershipHandlers.size > 0 || previewHandlers.size > 0 || disconnectTimer != null) return;

  disconnectTimer = window.setTimeout(() => {
    if (rooms.size === 0 && membershipHandlers.size === 0 && previewHandlers.size === 0) {
      disconnectNow();
    }
  }, 300);
}

function ensureClient(token: string): boolean {
  if (client && clientToken === token) {
    debugChatSocket("chat ws: reusing existing client");
    if (!client.active && !activating) {
      activating = true;
      debugChatSocket("chat ws: activating client");
      client.activate();
    }
    return true;
  }

  if (client && clientToken !== token) {
    disconnectNow();
  }

  const brokerURL = toWebSocketUrl(API_BASE_URL);
  clientToken = token;
  activating = true;
  debugChatSocket("chat ws: connecting to", brokerURL);

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
      logChatPreview("[CHAT_WS_CONNECTED]");
      debugChatSocket("chat ws: connected");
      subscribeAllRooms();
      notifyAllStatus(true);
    },
    onStompError: (frame) => {
      debugChatSocket("chat ws: stomp error", frame.headers?.message ?? frame.body);
      notifyAllStatus(false);
    },
    onWebSocketClose: () => {
      activating = false;
      rooms.forEach((room) => {
        room.stompSubscription = null;
        room.typingSubscription = null;
      });
      membershipSubscription = null;
      previewSubscription = null;
      notifyAllStatus(false);
    },
  });

  debugChatSocket("chat ws: activating client");
  client.activate();
  return true;
}

export function connectChatRoomSocket(
  roomId: string,
  onMessage: ChatMessageHandler,
  onStatusChange?: ChatStatusHandler,
  onTyping?: ChatTypingHandler
): () => void {
  clearDisconnectTimer();

  const token = getAccessToken();
  debugChatSocket("chat ws: token exists", Boolean(token));

  const room = roomEntry(roomId);
  room.handlers.add(onMessage);
  if (onTyping) room.typingHandlers.add(onTyping);
  if (onStatusChange) room.statusHandlers.add(onStatusChange);

  if (!token) {
    onStatusChange?.(false);
  } else if (ensureClient(token)) {
    if (client?.connected) {
      subscribeRoomOnClient(roomId);
      onStatusChange?.(Boolean(room.stompSubscription));
    } else {
      onStatusChange?.(false);
    }
  }

  return () => {
    const current = rooms.get(roomId);
    if (!current) return;

    current.handlers.delete(onMessage);
    if (onTyping) current.typingHandlers.delete(onTyping);
    if (onStatusChange) current.statusHandlers.delete(onStatusChange);

    if (current.handlers.size === 0 && current.typingHandlers.size === 0 && current.statusHandlers.size === 0) {
      current.stompSubscription?.unsubscribe();
      current.typingSubscription?.unsubscribe();
      rooms.delete(roomId);
      debugChatSocket(`chat ws: unsubscribed room ${roomId}`);
    }

    scheduleDisconnectIfIdle();
  };
}

export function connectChatMembershipSocket(onMembership: ChatMembershipHandler): () => void {
  clearDisconnectTimer();

  const token = getAccessToken();
  debugChatSocket("chat membership ws: token exists", Boolean(token));

  membershipHandlers.add(onMembership);
  if (token && ensureClient(token) && client?.connected) {
    subscribeMembershipOnClient();
  }

  return () => {
    membershipHandlers.delete(onMembership);
    if (membershipHandlers.size === 0) {
      membershipSubscription?.unsubscribe();
      membershipSubscription = null;
      debugChatSocket("chat membership unsubscribed");
    }
    scheduleDisconnectIfIdle();
  };
}

export function connectChatRoomPreviewSocket(onPreview: ChatPreviewHandler): () => void {
  clearDisconnectTimer();

  const token = getAccessToken();
  debugChatSocket("chat preview ws: token exists", Boolean(token));

  previewHandlers.add(onPreview);
  if (token && ensureClient(token) && client?.connected) {
    subscribePreviewOnClient();
  }

  return () => {
    previewHandlers.delete(onPreview);
    if (previewHandlers.size === 0) {
      previewSubscription?.unsubscribe();
      previewSubscription = null;
      debugChatSocket("chat room preview unsubscribed");
    }
    scheduleDisconnectIfIdle();
  };
}

export function sendChatSocketMessage(roomId: string, message: string): boolean {
  if (!client?.connected || !rooms.has(roomId)) {
    return false;
  }

  debugChatSocket("chat send via websocket", roomId);
  client.publish({
    destination: `/app/chat/rooms/${roomId}/send`,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  return true;
}

export function sendChatTypingEvent(roomId: string, typing: boolean): boolean {
  if (!client?.connected || !rooms.has(roomId)) {
    return false;
  }

  client.publish({
    destination: `/app/chat/rooms/${roomId}/typing`,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ typing }),
  });
  return true;
}

export function disconnectChatSocket() {
  rooms.clear();
  membershipHandlers.clear();
  previewHandlers.clear();
  disconnectNow();
}
