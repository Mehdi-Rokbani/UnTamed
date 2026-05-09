import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth.store";
import * as ChatApi from "../api/chat.api";
import { connectChatRoomSocket, sendChatSocketMessage, sendChatTypingEvent } from "../realtime/chatSocket";
import type { ChatMessage, ChatTypingEvent } from "../types/chat";

const PAGE_SIZE = 50;
const TYPING_EXPIRY_MS = 3000;
const MARK_READ_DEDUPE_MS = 3000;
const INITIAL_MESSAGES_DEDUPE_MS = 1000;

type InitialMessagesRequest = ReturnType<typeof ChatApi.listChatMessages>;

type TypingUser = {
  userId: string;
  username: string;
};

const lastMarkedReadByRoom = new Map<string, number>();
const initialMessagesByRoom = new Map<string, { expiresAt: number; promise: InitialMessagesRequest }>();
const messagesByRoomId = new Map<string, ChatMessage[]>();
const hasOlderByRoomId = new Map<string, boolean>();

function markRoomReadOnce(roomId: string) {
  const now = Date.now();
  const previous = lastMarkedReadByRoom.get(roomId) ?? 0;
  if (now - previous < MARK_READ_DEDUPE_MS) return;

  lastMarkedReadByRoom.set(roomId, now);
  console.log("[CHAT_MARK_READ]", roomId);
  ChatApi.markChatRoomRead(roomId).catch(() => undefined);
}

function loadInitialMessages(roomId: string) {
  const now = Date.now();
  const cached = initialMessagesByRoom.get(roomId);
  if (cached && cached.expiresAt > now) return cached.promise;

  console.log("[CHAT_FETCH_MESSAGES]", roomId);
  const promise = ChatApi.listChatMessages(roomId, 0, PAGE_SIZE);
  initialMessagesByRoom.set(roomId, {
    expiresAt: now + INITIAL_MESSAGES_DEDUPE_MS,
    promise,
  });
  promise.finally(() => {
    window.setTimeout(() => {
      const current = initialMessagesByRoom.get(roomId);
      if (current?.promise === promise) {
        initialMessagesByRoom.delete(roomId);
      }
    }, INITIAL_MESSAGES_DEDUPE_MS);
  });
  return promise;
}

function byCreatedAtAsc(a: ChatMessage, b: ChatMessage) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values()).sort(byCreatedAtAsc);
}

function debugChatState(message: string, detail?: unknown) {
  if (!import.meta.env.DEV) return;
  if (detail === undefined) {
    console.debug(message);
    return;
  }
  console.debug(message, detail);
}

function friendlyAccessError(message: string) {
  if (message.includes("HTTP 403")) return "You do not have access to this chat.";
  if (message.includes("HTTP 404")) return "Chat room not found.";
  return message || "Failed to load chat.";
}

export function useChatRoom(roomId: string | undefined) {
  const { user } = useAuth();
  const userIdRef = useRef<string | undefined>(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const normalizeMessage = useCallback((message: ChatMessage): ChatMessage => ({
    ...message,
    type: message.type ?? "TEXT",
    mine: message.type !== "SYSTEM" && Boolean(userIdRef.current && message.senderId === userIdRef.current),
  }), []);

  const normalizeMessages = useCallback(
    (items: ChatMessage[]) => items.map(normalizeMessage),
    [normalizeMessage]
  );

  const upsertMessage = useCallback((message: ChatMessage) => {
    debugChatState("chat state appended", message.id);
    const normalized = normalizeMessage(message);
    setMessages((current) => {
      const merged = mergeMessages(current, [normalized]);
      if (roomId) messagesByRoomId.set(roomId, merged);
      return merged;
    });
    if (roomId && message.senderId !== userIdRef.current) {
      markRoomReadOnce(roomId);
    }
  }, [normalizeMessage, roomId]);

  const removeTypingUser = useCallback((userId: string) => {
    const timer = typingTimersRef.current.get(userId);
    if (timer != null) {
      window.clearTimeout(timer);
      typingTimersRef.current.delete(userId);
    }
    setTypingUsers((current) => current.filter((item) => item.userId !== userId));
  }, []);

  const handleTypingEvent = useCallback((event: ChatTypingEvent) => {
    if (!roomId || event.roomId !== roomId || !event.userId || event.userId === user?.id) {
      return;
    }

    if (!event.typing) {
      removeTypingUser(event.userId);
      return;
    }

    const username = event.username?.trim() || "Someone";
    setTypingUsers((current) => {
      const withoutUser = current.filter((item) => item.userId !== event.userId);
      return [...withoutUser, { userId: event.userId, username }];
    });

    const previousTimer = typingTimersRef.current.get(event.userId);
    if (previousTimer != null) {
      window.clearTimeout(previousTimer);
    }
    const nextTimer = window.setTimeout(() => {
      removeTypingUser(event.userId);
    }, TYPING_EXPIRY_MS);
    typingTimersRef.current.set(event.userId, nextTimer);
  }, [removeTypingUser, roomId, user?.id]);

  const loadInitial = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    setError(null);
    try {
      console.log("[CHAT_FETCH_MESSAGES]", roomId);
      const data = await ChatApi.listChatMessages(roomId, 0, PAGE_SIZE);
      markRoomReadOnce(roomId);
      const nextMessages = normalizeMessages(data.content ?? []);
      messagesByRoomId.set(roomId, nextMessages);
      hasOlderByRoomId.set(roomId, !data.last);
      setMessages(nextMessages);
      setPage(0);
      setHasOlder(!data.last);
    } catch (e: any) {
      setError(friendlyAccessError(e?.message ?? "Failed to load chat."));
      setMessages([]);
      setHasOlder(false);
    } finally {
      setLoading(false);
    }
  }, [normalizeMessages, roomId]);

  useEffect(() => {
    let alive = true;
    if (!roomId) return;

    const cachedMessages = messagesByRoomId.get(roomId);
    if (cachedMessages) {
      setMessages(cachedMessages);
      setPage(0);
      setHasOlder(hasOlderByRoomId.get(roomId) ?? false);
      setError(null);
      setLoading(false);
      markRoomReadOnce(roomId);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);
    loadInitialMessages(roomId)
      .then((data) => {
        if (!alive) return;
        markRoomReadOnce(roomId);
        const nextMessages = normalizeMessages(data.content ?? []);
        messagesByRoomId.set(roomId, nextMessages);
        hasOlderByRoomId.set(roomId, !data.last);
        setMessages(nextMessages);
        setPage(0);
        setHasOlder(!data.last);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(friendlyAccessError(e?.message ?? "Failed to load chat."));
        setMessages([]);
        setHasOlder(false);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    return connectChatRoomSocket(
      roomId,
      upsertMessage,
      (connected) => setRealtimeConnected(connected),
      handleTypingEvent
    );
  }, [handleTypingEvent, roomId, upsertMessage]);

  useEffect(() => {
    setTypingUsers([]);
    typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    typingTimersRef.current.clear();

    return () => {
      typingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      typingTimersRef.current.clear();
    };
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (!roomId || loadingOlder || !hasOlder) return;

    const nextPage = page + 1;
    setLoadingOlder(true);
    try {
      const data = await ChatApi.listChatMessages(roomId, nextPage, PAGE_SIZE);
      const olderMessages = normalizeMessages(data.content ?? []);
      setMessages((current) => {
        const merged = mergeMessages(olderMessages, current);
        messagesByRoomId.set(roomId, merged);
        return merged;
      });
      setPage(nextPage);
      setHasOlder(!data.last);
      hasOlderByRoomId.set(roomId, !data.last);
    } catch (e: any) {
      setError(friendlyAccessError(e?.message ?? "Failed to load older messages."));
    } finally {
      setLoadingOlder(false);
    }
  }, [hasOlder, loadingOlder, normalizeMessages, page, roomId]);

  const sendMessage = useCallback(async (rawMessage: string) => {
    if (!roomId) return false;

    const text = rawMessage.trim();
    if (!text || text.length > 1000) return false;

    setSending(true);
    setError(null);
    try {
      const sentOverSocket = sendChatSocketMessage(roomId, text);
      if (!sentOverSocket) {
        debugChatState("chat send via REST fallback", roomId);
        const saved = await ChatApi.sendChatMessage(roomId, text);
        upsertMessage(saved);
      }
      return true;
    } catch (e: any) {
      setError(friendlyAccessError(e?.message ?? "Failed to send message."));
      return false;
    } finally {
      setSending(false);
    }
  }, [roomId, upsertMessage]);

  const sendTyping = useCallback((typing: boolean) => {
    if (!roomId || !realtimeConnected) return false;
    return sendChatTypingEvent(roomId, typing);
  }, [realtimeConnected, roomId]);

  return useMemo(() => ({
    messages,
    typingUsers,
    loading,
    loadingOlder,
    sending,
    error,
    hasOlder,
    realtimeConnected,
    realtimeUnavailable: !realtimeConnected,
    loadOlder,
    reload: loadInitial,
    sendMessage,
    sendTyping,
  }), [
    error,
    hasOlder,
    loadInitial,
    loadOlder,
    loading,
    loadingOlder,
    messages,
    realtimeConnected,
    sendMessage,
    sendTyping,
    sending,
    typingUsers,
  ]);
}
