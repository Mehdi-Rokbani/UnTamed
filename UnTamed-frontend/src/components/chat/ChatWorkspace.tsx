import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "../Header";
import { BackButton } from "../BackButton";
import * as ChatApi from "../../api/chat.api";
import { useChatRoom } from "../../hooks/useChatRoom";
import { connectChatMembershipSocket, connectChatRoomPreviewSocket } from "../../realtime/chatSocket";
import type { ChatMessage, ChatRoom, ChatRoomMembershipEvent, ChatRoomPreviewEvent } from "../../types/chat";
import type { PaginatedResponse } from "../../types/pagination";
import styles from "../../style/chat.module.css";

const ROOM_PAGE_SIZE = 50;
const MAX_MESSAGE_LENGTH = 1000;
const GROUP_WINDOW_MS = 2 * 60 * 1000;
const TYPING_THROTTLE_MS = 900;
const TYPING_STOP_DELAY_MS = 1200;

type ChatWorkspaceProps = {
  selectedRoomId?: string;
};

type MessageDisplayItem =
  | { type: "day"; id: string; label: string }
  | { type: "message"; id: string; message: ChatMessage; firstInGroup: boolean };

function relativeTime(value?: string | null) {
  if (!value) return "No messages yet";

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";

  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} hr ago`;
  if (diff < 2 * day) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const key = date.toDateString();
  if (key === today.toDateString()) return "Today";
  if (key === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function dateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toDateString();
}

function senderInitial(name?: string | null) {
  return (name?.trim() || "U").slice(0, 1).toUpperCase();
}

function roleLabel(role?: string | null) {
  if (role === "GUIDE") return "Guide";
  if (role === "ADVENTURER" || role === "USER") return "Adventurer";
  return "Member";
}

function mergeRooms(existing: ChatRoom[], incoming: ChatRoom[]) {
  const byId = new Map<string, ChatRoom>();
  for (const room of existing) byId.set(room.id, room);
  for (const room of incoming) byId.set(room.id, room);
  return Array.from(byId.values()).sort((a, b) => {
    const left = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
    const right = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
    return right - left;
  });
}

function sortRoomsByLatest(rooms: ChatRoom[]) {
  return [...rooms].sort((a, b) => {
    const left = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
    const right = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
    return right - left;
  });
}

function upsertRoomPreview(prevRooms: ChatRoom[], event: ChatRoomPreviewEvent) {
  if (event.type === "ROOM_REMOVED") {
    return prevRooms.filter((room) => room.id !== event.roomId);
  }

  let found = false;
  const updated = prevRooms.map((room) => {
    if (room.id !== event.roomId) return room;
    found = true;
    return {
      ...room,
      sessionId: event.sessionId ?? room.sessionId,
      lastMessagePreview: event.lastMessageText ?? room.lastMessagePreview,
      lastMessageAt: event.lastMessageAt ?? room.lastMessageAt,
      updatedAt: event.lastMessageAt ?? room.updatedAt,
      participantCount: event.participantCount ?? room.participantCount,
    };
  });

  if (!found && event.roomId && event.sessionId) {
    updated.push({
      id: event.roomId,
      sessionId: event.sessionId,
      templateId: null,
      guideId: null,
      activityTitle: "Session chat",
      activityImageUrl: null,
      participantCount: event.participantCount ?? 0,
      lastMessagePreview: event.lastMessageText,
      lastMessageAt: event.lastMessageAt,
      createdAt: event.lastMessageAt,
      updatedAt: event.lastMessageAt,
    });
  }

  return sortRoomsByLatest(updated);
}

function buildMessageItems(messages: ChatMessage[]): MessageDisplayItem[] {
  const items: MessageDisplayItem[] = [];
  let previous: ChatMessage | null = null;
  let previousDay = "";

  for (const message of messages) {
    const currentDay = dateKey(message.createdAt);
    if (currentDay !== previousDay) {
      items.push({ type: "day", id: `day-${currentDay}`, label: dayLabel(message.createdAt) });
      previousDay = currentDay;
      previous = null;
    }

    const previousTime = previous ? new Date(previous.createdAt).getTime() : 0;
    const currentTime = new Date(message.createdAt).getTime();
    const firstInGroup = !previous
      || previous.senderId !== message.senderId
      || Number.isNaN(previousTime)
      || Number.isNaN(currentTime)
      || currentTime - previousTime > GROUP_WINDOW_MS;

    items.push({ type: "message", id: message.id, message, firstInGroup });
    previous = message;
  }

  return items;
}

function RoomThumb({ room, className }: { room: ChatRoom; className: string }) {
  const title = room.activityTitle || "Session chat";
  return (
    <div className={className}>
      {room.activityImageUrl ? (
        <img src={room.activityImageUrl} alt="" />
      ) : (
        <span aria-hidden="true">{title.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function ChatSidebar({
  rooms,
  selectedRoomId,
  loading,
  error,
  query,
  onQueryChange,
  onRetry,
  hasMore,
  onLoadMore,
}: {
  rooms: ChatRoom[];
  selectedRoomId?: string;
  loading: boolean;
  error: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rooms;
    return rooms.filter((room) => {
      const title = room.activityTitle?.toLowerCase() ?? "";
      const preview = room.lastMessagePreview?.toLowerCase() ?? "";
      return title.includes(needle) || preview.includes(needle);
    });
  }, [query, rooms]);

  return (
    <aside className={styles.sidebar} aria-label="Chat rooms">
      <div className={styles.sidebarHead}>
        <div>
          <h1>Messages</h1>
          <p>Trip groups & guide conversations</p>
        </div>
      </div>

      <label className={styles.searchBox}>
        <span className={styles.srOnly}>Search chats</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search chats..."
          type="search"
        />
      </label>

      {error && (
        <div className={styles.sidebarError}>
          <span>{error}</span>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      )}

      <div className={styles.roomList} aria-busy={loading}>
        {loading && rooms.length === 0 && (
          Array.from({ length: 6 }).map((_, index) => (
            <div className={styles.skeletonRoom} key={index} />
          ))
        )}

        {!loading && !error && filteredRooms.length === 0 && (
          <div className={styles.sidebarEmpty}>
            <strong>No trip chats yet</strong>
            <span>Confirmed bookings and guided sessions will appear here.</span>
          </div>
        )}

        {filteredRooms.map((room) => (
          <ChatRoomListItem room={room} active={room.id === selectedRoomId} key={room.id} />
        ))}

        {hasMore && !query && (
          <button type="button" className={styles.loadMoreRooms} onClick={onLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </aside>
  );
}

function ChatRoomListItem({ room, active }: { room: ChatRoom; active: boolean }) {
  const title = room.activityTitle || "Session chat";
  return (
    <Link
      to={`/chat/rooms/${room.id}`}
      className={`${styles.roomItem} ${active ? styles.roomItemActive : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <RoomThumb room={room} className={styles.roomThumb} />
      <span className={styles.roomInfo}>
        <span className={styles.roomTitle}>{title}</span>
        <span className={styles.roomPreview}>{room.lastMessagePreview || "No messages yet - start the trip conversation."}</span>
        <span className={styles.roomMeta}>
          <span>{room.participantCount + 1} members</span>
          <span>{relativeTime(room.lastMessageAt ?? room.updatedAt)}</span>
        </span>
      </span>
    </Link>
  );
}

function ChatRoomHeader({
  room,
  connected,
}: {
  room: ChatRoom | null;
  connected: boolean;
}) {
  const title = room?.activityTitle || "Session group chat";
  return (
    <header className={styles.roomHeader}>
      <BackButton fallbackTo="/chat" variant="plain" className={styles.mobileBack} />
      {room ? (
        <RoomThumb room={room} className={styles.headerThumb} />
      ) : (
        <div className={styles.headerThumb}><span>UT</span></div>
      )}
      <div className={styles.headerInfo}>
        <span className={styles.headerEyebrow}>Session group chat</span>
        <h2 className={styles.headerTitle}>{title}</h2>
        <div className={styles.headerMeta}>
          <span className={styles.participantChip}>{room ? room.participantCount + 1 : 0} members</span>
          <span className={connected ? styles.statusLive : styles.statusOffline}>
            <i aria-hidden="true" />
            {connected ? "Live" : "Offline mode - messages still send"}
          </span>
        </div>
      </div>
      <button type="button" className={styles.headerAction} disabled title="Coming soon">
        View trip
      </button>
    </header>
  );
}

function MessageBubble({ message, firstInGroup }: { message: ChatMessage; firstInGroup: boolean }) {
  if ((message.type ?? "TEXT") === "SYSTEM") {
    return (
      <div className={styles.systemMessageRow}>
        <span className={styles.systemMessagePill}>{message.message}</span>
        <time className={styles.systemMessageTime}>{messageTime(message.createdAt)}</time>
      </div>
    );
  }

  const theirs = !message.mine;
  return (
    <article
      className={`${styles.messageRow} ${message.mine ? styles.messageRowMine : ""} ${!firstInGroup ? styles.messageGrouped : ""}`}
    >
      {theirs && (
        <div className={`${styles.avatarWrap} ${!firstInGroup ? styles.avatarHidden : ""}`}>
          {message.senderProfileImageUrl ? (
            <img src={message.senderProfileImageUrl} alt="" />
          ) : (
            <span>{senderInitial(message.senderUsername)}</span>
          )}
        </div>
      )}
      <div className={styles.messageGroup}>
        {theirs && firstInGroup && (
          <div className={styles.senderRow}>
            <span>{message.senderUsername || "Trip member"}</span>
            <em className={styles.roleBadge}>{roleLabel(message.senderRole)}</em>
          </div>
        )}
        <div className={`${styles.bubble} ${message.mine ? styles.bubbleMine : styles.bubbleTheirs}`}>
          <p>{message.message}</p>
        </div>
        <time className={styles.messageTime}>{messageTime(message.createdAt)}</time>
      </div>
    </article>
  );
}

function TypingIndicator({ users = [] }: { users?: string[] }) {
  const label = users.length === 1
    ? `${users[0]} is typing...`
    : users.length > 1
      ? `${users.length} people are typing...`
      : "";

  return (
    <div className={styles.typingRow} aria-live="polite">
      {label && (
        <>
          <span className={styles.typingBubble} aria-hidden="true">
            <i className={styles.typingDot} />
            <i className={styles.typingDot} />
            <i className={styles.typingDot} />
          </span>
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  onKeyDown,
  canSend,
  sending,
  disabled,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  canSend: boolean;
  sending: boolean;
  disabled?: boolean;
}) {
  const nearLimit = draft.length > 850;
  return (
    <form className={styles.composer} onSubmit={onSubmit}>
      <div className={styles.composerInner}>
        <textarea
          className={styles.composerTextarea}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Message the group…"
          aria-label="Message the group"
          disabled={disabled}
          rows={1}
        />
        <div className={styles.composerActions}>
          {nearLimit && <span className={styles.charCounter}>{MAX_MESSAGE_LENGTH - draft.length}</span>}
          <button type="submit" className={styles.sendButton} disabled={!canSend || disabled}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
      <div className={styles.composerHint}>Enter to send · Shift+Enter for new line</div>
    </form>
  );
}

function MessageList({
  chat,
  onLoadOlder,
}: {
  chat: ReturnType<typeof useChatRoom>;
  onLoadOlder: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const previousCountRef = useRef(0);

  const items = useMemo(() => buildMessageItems(chat.messages), [chat.messages]);

  useEffect(() => {
    const node = listRef.current;
    if (!node || chat.loading) return;

    const wasNearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 110;
    const countIncreased = chat.messages.length > previousCountRef.current;
    previousCountRef.current = chat.messages.length;

    if (firstLoadRef.current || wasNearBottom) {
      node.scrollTo({ top: node.scrollHeight, behavior: firstLoadRef.current ? "auto" : "smooth" });
      firstLoadRef.current = false;
      setShowNewMessages(false);
    } else if (countIncreased) {
      setShowNewMessages(true);
    }
  }, [chat.loading, chat.messages.length]);

  const jumpToLatest = () => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    setShowNewMessages(false);
  };

  return (
    <div className={styles.messageListWrap}>
      {chat.hasOlder && (
        <div className={styles.olderWrap}>
          <button type="button" onClick={onLoadOlder} disabled={chat.loadingOlder}>
            {chat.loadingOlder ? "Loading..." : "Load older messages"}
          </button>
        </div>
      )}
      <div
        className={styles.messageList}
        ref={listRef}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        aria-busy={chat.loading}
      >
        {chat.loading && (
          Array.from({ length: 6 }).map((_, index) => (
            <div className={styles.skeletonMessage} key={index} />
          ))
        )}

        {!chat.loading && chat.messages.length === 0 && !chat.error && (
          <div className={styles.chatEmpty}>
            <h2>No messages yet</h2>
            <p>Start the trip conversation.</p>
          </div>
        )}

        {!chat.loading && items.map((item) => (
          item.type === "day" ? (
            <div className={styles.daySeparator} key={item.id}><span>{item.label}</span></div>
          ) : (
            <MessageBubble
              key={item.id}
              message={item.message}
              firstInGroup={item.firstInGroup}
            />
          )
        ))}
      </div>
      {showNewMessages && (
        <button type="button" className={styles.newMessagesButton} onClick={jumpToLatest}>
          Down New messages
        </button>
      )}
    </div>
  );
}

function ChatRoomPanel({
  roomId,
  room,
  accessLostMessage,
}: {
  roomId: string;
  room: ChatRoom | null;
  accessLostMessage: string | null;
}) {
  const chat = useChatRoom(roomId);
  const sendTyping = chat.sendTyping;
  const [draft, setDraft] = useState("");
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimerRef = useRef<number | null>(null);
  const trimmedDraft = draft.trim();
  const accessLost = Boolean(accessLostMessage);
  const canSend = trimmedDraft.length > 0 && trimmedDraft.length <= MAX_MESSAGE_LENGTH && !chat.sending && !accessLost;

  const clearTypingStopTimer = useCallback(() => {
    if (typingStopTimerRef.current == null) return;
    window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
  }, []);

  const sendStoppedTypingSoon = useCallback(() => {
    clearTypingStopTimer();
    typingStopTimerRef.current = window.setTimeout(() => {
      sendTyping(false);
      typingStopTimerRef.current = null;
    }, TYPING_STOP_DELAY_MS);
  }, [clearTypingStopTimer, sendTyping]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);

    if (!value.trim()) {
      clearTypingStopTimer();
      sendTyping(false);
      lastTypingSentAtRef.current = 0;
      return;
    }

    if (accessLost) {
      return;
    }

    const now = Date.now();
    if (now - lastTypingSentAtRef.current >= TYPING_THROTTLE_MS) {
      sendTyping(true);
      lastTypingSentAtRef.current = now;
    }
    sendStoppedTypingSoon();
  }, [accessLost, clearTypingStopTimer, sendStoppedTypingSoon, sendTyping]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;

    const sent = await chat.sendMessage(trimmedDraft);
    if (sent) {
      setDraft("");
      clearTypingStopTimer();
      sendTyping(false);
      lastTypingSentAtRef.current = 0;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend) event.currentTarget.form?.requestSubmit();
  };

  useEffect(() => () => {
    clearTypingStopTimer();
    sendTyping(false);
  }, [clearTypingStopTimer, sendTyping]);

  useEffect(() => {
    if (!accessLost) return;
    setDraft("");
    clearTypingStopTimer();
    sendTyping(false);
  }, [accessLost, clearTypingStopTimer, sendTyping]);

  return (
    <section className={styles.panel} aria-label="Selected chat">
      <ChatRoomHeader room={room} connected={chat.realtimeConnected} />
      {chat.error && (
        <div className={styles.panelError}>
          <span>{chat.error}</span>
          <button type="button" onClick={chat.reload}>Retry</button>
        </div>
      )}
      {accessLostMessage && (
        <div className={styles.accessLostNotice} role="status" aria-live="polite">
          <strong>You no longer have access to this chat.</strong>
          <span>{accessLostMessage}</span>
          <Link to="/chat">Back to messages</Link>
        </div>
      )}
      {accessLost ? (
        <div className={styles.chatAccessLostBody}>
          <h2>Chat access ended</h2>
          <p>This room is hidden because your confirmed booking is no longer active.</p>
        </div>
      ) : (
        <MessageList chat={chat} onLoadOlder={chat.loadOlder} />
      )}
      <TypingIndicator users={accessLost ? [] : chat.typingUsers.map((item) => item.username)} />
      <ChatComposer
        draft={draft}
        onDraftChange={handleDraftChange}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        canSend={canSend}
        sending={chat.sending}
        disabled={accessLost}
      />
    </section>
  );
}

function PanelEmpty() {
  return (
    <section className={styles.panelEmpty} aria-label="No chat selected">
      <div>
        <span className={styles.emptyMark}>UT</span>
        <h2>Select a trip chat to continue</h2>
        <p>Your confirmed bookings and guided sessions live here.</p>
      </div>
    </section>
  );
}

export function ChatWorkspace({ selectedRoomId }: ChatWorkspaceProps) {
  const [roomsPage, setRoomsPage] = useState<PaginatedResponse<ChatRoom> | null>(null);
  const [pageNumber, setPageNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [accessLostByRoomId, setAccessLostByRoomId] = useState<Record<string, string>>({});

  const rooms = roomsPage?.content ?? [];
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

  const loadRooms = async (page = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await ChatApi.listChatRooms(page, ROOM_PAGE_SIZE);
      setRoomsPage((prev) => page === 0
        ? data
        : { ...data, content: mergeRooms(prev?.content ?? [], data.content ?? []) });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load trip chats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    ChatApi.listChatRooms(pageNumber, ROOM_PAGE_SIZE)
      .then((data) => {
        if (!alive) return;
        setRoomsPage((prev) => pageNumber === 0
          ? data
          : { ...data, content: mergeRooms(prev?.content ?? [], data.content ?? []) });
      })
      .catch((e: any) => {
        if (alive) setError(e?.message ?? "Failed to load trip chats.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [pageNumber]);

  useEffect(() => {
    if (!selectedRoomId || loading || error || selectedRoom || rooms.length === 0) return;
    loadRooms(0).catch(() => undefined);
  }, [error, loading, rooms.length, selectedRoom, selectedRoomId]);

  useEffect(() => {
    function handleMembershipEvent(event: ChatRoomMembershipEvent) {
      if (event.type !== "REMOVED" || !event.roomId) return;

      setRoomsPage((current) => current
        ? {
          ...current,
          content: current.content.filter((room) => room.id !== event.roomId),
          totalElements: Math.max(0, current.totalElements - 1),
        }
        : current);

      setAccessLostByRoomId((current) => ({
        ...current,
        [event.roomId]: event.message || "You no longer have access to this chat.",
      }));
    }

    return connectChatMembershipSocket(handleMembershipEvent);
  }, []);

  useEffect(() => {
    function handlePreviewEvent(event: ChatRoomPreviewEvent) {
      if (!event.roomId) return;

      setRoomsPage((current) => {
        if (!current) return current;
        const content = upsertRoomPreview(current.content, event);
        return {
          ...current,
          content,
          totalElements: event.type === "ROOM_REMOVED"
            ? Math.max(0, current.totalElements - 1)
            : Math.max(current.totalElements, content.length),
        };
      });

      if (event.type === "ROOM_REMOVED") {
        setAccessLostByRoomId((current) => ({
          ...current,
          [event.roomId]: "You no longer have access to this chat.",
        }));
      }
    }

    return connectChatRoomPreviewSocket(handlePreviewEvent);
  }, []);

  return (
    <>
      <Header opaque />
      <main className={`${styles.layout} ${selectedRoomId ? styles.layoutWithRoom : styles.layoutListOnly}`}>
        <div className={styles.workspaceTop}>
          <BackButton fallbackTo="/home" variant="plain" />
          <Link to="/chat" className={styles.allMessagesLink}>
            All messages
          </Link>
        </div>
        <div className={styles.workspace}>
          <ChatSidebar
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            loading={loading}
            error={error}
            query={query}
            onQueryChange={setQuery}
            onRetry={() => loadRooms(0)}
            hasMore={Boolean(roomsPage && !roomsPage.last)}
            onLoadMore={() => setPageNumber((current) => current + 1)}
          />
          {selectedRoomId ? (
            <ChatRoomPanel
              roomId={selectedRoomId}
              room={selectedRoom}
              accessLostMessage={accessLostByRoomId[selectedRoomId] ?? null}
            />
          ) : (
            <PanelEmpty />
          )}
        </div>
      </main>
    </>
  );
}
