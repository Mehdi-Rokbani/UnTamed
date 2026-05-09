import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import * as ChatApi from "../../api/chat.api";
import { useChatRoom } from "../../hooks/useChatRoom";
import type { ChatMessage, ChatRoom } from "../../types/chat";
import styles from "../../style/chat.module.css";

const MAX_MESSAGE_LENGTH = 1000;

type MiniChatPopupProps = {
  roomId: string;
  onClose: () => void;
  onExpand?: () => void;
  initialRoom?: ChatRoom | null;
};

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function senderInitial(message: ChatMessage) {
  return (message.senderUsername?.trim() || "U").slice(0, 1).toUpperCase();
}

function isChatRoute(pathname: string) {
  return pathname === "/chat" || pathname.startsWith("/chat/rooms/");
}

function RoomAvatar({ room }: { room: ChatRoom | null }) {
  const title = room?.activityTitle || "Chat";
  return (
    <div className={styles.miniChatAvatar}>
      {room?.activityImageUrl ? (
        <img src={room.activityImageUrl} alt="" />
      ) : (
        <span>{title.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

function MiniMessage({ message }: { message: ChatMessage }) {
  if ((message.type ?? "TEXT") === "SYSTEM") {
    return <div className={styles.miniSystemMessage}>{message.message}</div>;
  }

  return (
    <div className={`${styles.miniMessageRow} ${message.mine ? styles.miniMessageMine : ""}`}>
      {!message.mine && (
        <div className={styles.miniMessageAvatar}>
          {message.senderProfileImageUrl ? (
            <img src={message.senderProfileImageUrl} alt="" />
          ) : (
            <span>{senderInitial(message)}</span>
          )}
        </div>
      )}
      <div className={styles.miniMessageGroup}>
        {!message.mine && <span className={styles.miniSenderName}>{message.senderUsername || "Trip member"}</span>}
        <div className={`${styles.miniBubble} ${message.mine ? styles.miniBubbleMine : styles.miniBubbleTheirs}`}>
          {message.message}
        </div>
        <time className={styles.miniMessageTime}>{messageTime(message.createdAt)}</time>
      </div>
    </div>
  );
}

function MiniChatPopupContent({ roomId, onClose, onExpand, initialRoom = null }: MiniChatPopupProps) {
  const chat = useChatRoom(roomId);
  const [room, setRoom] = useState<ChatRoom | null>(initialRoom);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const trimmedDraft = draft.trim();
  const canSend = trimmedDraft.length > 0 && trimmedDraft.length <= MAX_MESSAGE_LENGTH && !chat.sending;

  useEffect(() => {
    if (initialRoom?.id === roomId) {
      setRoom(initialRoom);
      return;
    }

    let alive = true;
    ChatApi.listChatRooms(0, 50)
      .then((page) => {
        if (!alive) return;
        setRoom((page.content ?? []).find((item) => item.id === roomId) ?? null);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [initialRoom, roomId]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length]);

  const title = room?.activityTitle || "Session chat";
  const membersLabel = useMemo(() => {
    if (!room) return "Trip group";
    return `${room.participantCount + 1} members`;
  }, [room]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const sent = await chat.sendMessage(trimmedDraft);
    if (sent) setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (canSend) event.currentTarget.form?.requestSubmit();
  };

  return (
    <section className={styles.miniChatPopup} aria-label={`Mini chat for ${title}`}>
      <header className={styles.miniChatHeader}>
        <RoomAvatar room={room} />
        <div className={styles.miniChatTitleBlock}>
          <strong>{title}</strong>
          <span>{chat.realtimeConnected ? "Live" : "Offline mode"} - {membersLabel}</span>
        </div>
        <button type="button" className={styles.miniChatExpand} onClick={onExpand} aria-label="Open full chat">
          Open
        </button>
        <button type="button" className={styles.miniChatClose} onClick={onClose} aria-label="Close chat">
          x
        </button>
      </header>

      <div className={styles.miniChatBody} ref={listRef} role="log" aria-live="polite" aria-busy={chat.loading}>
        {chat.loading && <div className={styles.miniChatState}>Loading messages...</div>}
        {!chat.loading && chat.error && (
          <div className={styles.miniChatState}>
            <strong>{chat.error}</strong>
            <button type="button" onClick={chat.reload}>Retry</button>
          </div>
        )}
        {!chat.loading && !chat.error && chat.messages.length === 0 && (
          <div className={styles.miniChatState}>No messages yet.</div>
        )}
        {!chat.loading && !chat.error && chat.messages.map((message) => (
          <MiniMessage message={message} key={message.id} />
        ))}
      </div>

      <form className={styles.miniChatInput} onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Message the group..."
          aria-label="Message the group"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <button type="submit" disabled={!canSend}>
          Send
        </button>
      </form>
    </section>
  );
}

export function MiniChatPopup(props: MiniChatPopupProps) {
  const location = useLocation();
  const chatRoute = isChatRoute(location.pathname);
  const { onClose } = props;

  useEffect(() => {
    if (chatRoute) onClose();
  }, [chatRoute, onClose]);

  if (chatRoute) return null;

  return <MiniChatPopupContent {...props} />;
}
