import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/auth.store";
import * as ChatApi from "../api/chat.api";
import { connectChatRoomSocket, sendChatSocketMessage, sendChatTypingEvent } from "../realtime/chatSocket";
import type { ChatMessage, ChatTypingEvent } from "../types/chat";

const PAGE_SIZE = 50;
const TYPING_EXPIRY_MS = 3000;

type TypingUser = {
  userId: string;
  username: string;
};

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

  const normalizeMessage = useCallback((message: ChatMessage): ChatMessage => ({
    ...message,
    type: message.type ?? "TEXT",
    mine: message.type !== "SYSTEM" && Boolean(user?.id && message.senderId === user.id),
  }), [user?.id]);

  const normalizeMessages = useCallback(
    (items: ChatMessage[]) => items.map(normalizeMessage),
    [normalizeMessage]
  );

  const upsertMessage = useCallback((message: ChatMessage) => {
    debugChatState("chat state appended", message.id);
    setMessages((current) => mergeMessages(current, [normalizeMessage(message)]));
  }, [normalizeMessage]);

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
      const data = await ChatApi.listChatMessages(roomId, 0, PAGE_SIZE);
      setMessages(normalizeMessages(data.content ?? []));
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

    setLoading(true);
    setError(null);
    ChatApi.listChatMessages(roomId, 0, PAGE_SIZE)
      .then((data) => {
        if (!alive) return;
        setMessages(normalizeMessages(data.content ?? []));
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
  }, [normalizeMessages, roomId]);

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
      setMessages((current) => mergeMessages(normalizeMessages(data.content ?? []), current));
      setPage(nextPage);
      setHasOlder(!data.last);
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
