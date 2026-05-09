import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "../style/header.module.css";
import { useAuth } from "../auth/auth.store";
import { useNotifications } from "../hooks/useNotifications";
import * as ChatApi from "../api/chat.api";
import { MiniChatPopup } from "./chat/MiniChatPopup";
import { connectChatMembershipSocket, connectChatRoomPreviewSocket } from "../realtime/chatSocket";
import type { ChatRoom, ChatRoomPreviewEvent } from "../types/chat";
import type { Notification } from "../types/notification";
import {
  getNotificationMeta,
  NotificationGlyph,
  relativeNotificationTime,
} from "../utils/notificationUi";

type HeaderProps = {
  /** Compact search bar node rendered in the center slot. */
  compactSearch?: React.ReactNode;
  /**
   * Forces a solid opaque background regardless of scroll position.
   * Use on form / dashboard pages that sit above white or cream content
   * (i.e. no hero image underneath the header).
   */
  opaque?: boolean;
  /**
   * 0–100. When provided, renders a thin animated orange progress bar
   * pinned immediately below the header. Useful for multi-step forms.
   */
  stepProgress?: number;
};

export function Header({ compactSearch, opaque = false, stepProgress }: HeaderProps) {
  const [scrolled, setScrolled]             = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [miniChatRoomId, setMiniChatRoomId] = useState<string | null>(null);
  const [bellPulse, setBellPulse] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { user, signOut } = useAuth();
  const notifications = useNotifications();
  const navigate          = useNavigate();
  const location          = useLocation();
  const dropdownRef       = useRef<HTMLDivElement>(null);
  const notificationRef   = useRef<HTMLDivElement>(null);
  const messagesRef       = useRef<HTMLDivElement>(null);
  const visibleChatRoomIdRef = useRef<string | null>(null);
  const messagesOpenRef = useRef(false);
  const isChatPageRef = useRef(false);
  const chatRoomsLoadedAtRef = useRef(0);
  const chatRoomsLoadingRef = useRef(false);

  /* ── Scroll listener ── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(target)) {
        setMessagesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!notificationsOpen && !messagesOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationsOpen(false);
      if (e.key === "Escape") setMessagesOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [messagesOpen, notificationsOpen]);

  useEffect(() => {
    if (notifications.realtimeEventId === 0) return;

    setBellPulse(true);
    const timer = window.setTimeout(() => setBellPulse(false), 420);
    return () => window.clearTimeout(timer);
  }, [notifications.realtimeEventId]);

  /* ── Prevent body scroll when mobile menu is open ── */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const toggleMobileMenu = () => setMobileMenuOpen((v) => !v);
  const closeMobileMenu  = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    await signOut();
    setDropdownOpen(false);
    setNotificationsOpen(false);
    setMessagesOpen(false);
    closeMobileMenu();
    navigate("/login");
  };

  const openNotifications = async () => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      navigate("/notifications");
      return;
    }

    const willOpen = !notificationsOpen;
    setDropdownOpen(false);
    setMessagesOpen(false);
    setNotificationsOpen(willOpen);
    if (willOpen) {
      await notifications.loadLatest().catch(() => undefined);
    }
  };

  const activeRoomId = useMemo(() => {
    const match = location.pathname.match(/^\/chat\/rooms\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);
  const isChatPage = location.pathname === "/chat" || location.pathname.startsWith("/chat/rooms/");
  const visibleChatRoomId = miniChatRoomId ?? activeRoomId;

  useEffect(() => {
    visibleChatRoomIdRef.current = visibleChatRoomId;
    messagesOpenRef.current = messagesOpen;
    isChatPageRef.current = isChatPage;
  }, [isChatPage, messagesOpen, visibleChatRoomId]);

  const sortChatRooms = (rooms: ChatRoom[]) => [...rooms].sort((a, b) => {
    const left = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
    const right = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
    return right - left;
  });

  const loadChatRooms = async (force = false) => {
    if (!user) return;
    if (!force && chatRooms.length > 0 && Date.now() - chatRoomsLoadedAtRef.current < 30_000) return;
    if (chatRoomsLoadingRef.current) return;
    chatRoomsLoadingRef.current = true;
    setChatLoading(true);
    setChatError(null);
    try {
      const page = await ChatApi.listChatRooms(0, 10);
      chatRoomsLoadedAtRef.current = Date.now();
      setChatRooms(sortChatRooms(page.content ?? []));
    } catch (e: any) {
      setChatError(e?.message ?? "Could not load messages.");
    } finally {
      chatRoomsLoadingRef.current = false;
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setChatRooms([]);
      setChatError(null);
      chatRoomsLoadedAtRef.current = 0;
      chatRoomsLoadingRef.current = false;
      return;
    }
    return connectChatRoomPreviewSocket((event: ChatRoomPreviewEvent) => {
      if (!event.roomId) return;
      setChatRooms((current) => {
        if (event.type === "ROOM_REMOVED") {
          return current.filter((room) => room.id !== event.roomId);
        }

        const existing = current.find((room) => room.id === event.roomId);
        if (!existing) {
          if (
            event.type === "MESSAGE_CREATED"
            && messagesOpenRef.current
            && !isChatPageRef.current
          ) {
            loadChatRooms(true).catch(() => undefined);
          }
          return current;
        }

        const shouldIncrement = event.type === "MESSAGE_CREATED"
          && event.lastMessageSenderId !== user.id
          && visibleChatRoomIdRef.current !== event.roomId;

        return sortChatRooms(current.map((room) => room.id === event.roomId
          ? {
            ...room,
            sessionId: event.sessionId ?? room.sessionId,
            lastMessagePreview: event.lastMessagePreview ?? room.lastMessagePreview,
            lastMessageSenderName: event.lastMessageSenderName ?? room.lastMessageSenderName,
            lastMessageAt: event.lastMessageAt ?? room.lastMessageAt,
            updatedAt: event.lastMessageAt ?? room.updatedAt,
            participantCount: event.participantCount ?? room.participantCount,
            unreadCount: shouldIncrement ? (room.unreadCount ?? 0) + 1 : room.unreadCount ?? 0,
          }
          : room));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!visibleChatRoomId) return;
    setChatRooms((current) => current.map((room) => (
      room.id === visibleChatRoomId ? { ...room, unreadCount: 0 } : room
    )));
  }, [visibleChatRoomId]);

  useEffect(() => {
    if (isChatPage) {
      setMiniChatRoomId(null);
    }
  }, [isChatPage]);

  useEffect(() => {
    if (!user) return;
    return connectChatMembershipSocket((event) => {
      if (event.type !== "REMOVED" || !event.roomId) return;
      setChatRooms((current) => current.filter((room) => room.id !== event.roomId));
      if (miniChatRoomId === event.roomId) {
        setMiniChatRoomId(null);
      }
    });
  }, [miniChatRoomId, user]);

  const openMessages = async () => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      navigate("/chat");
      return;
    }

    const willOpen = !messagesOpen;
    setDropdownOpen(false);
    setNotificationsOpen(false);
    setMessagesOpen(willOpen);
    if (willOpen && !isChatPage) {
      await loadChatRooms().catch(() => undefined);
    }
  };

  const handleChatClick = async (room: ChatRoom) => {
    setMessagesOpen(false);
    setChatRooms((current) => current.map((item) => item.id === room.id ? { ...item, unreadCount: 0 } : item));
    if (isChatPage) {
      navigate(`/chat/rooms/${room.id}`);
      return;
    }
    setMiniChatRoomId(room.id);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await notifications.markRead(notification).catch(() => undefined);
    setNotificationsOpen(false);
    if (notification.actionUrl?.startsWith("/")) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await notifications.markAllRead().catch(() => undefined);
  };

  const bellAriaLabel = notifications.unreadCount > 0
    ? `Notifications, ${notifications.unreadCount} unread`
    : "Notifications";
  const chatUnreadCount = useMemo(
    () => chatRooms.reduce((total, room) => total + Math.max(0, room.unreadCount ?? 0), 0),
    [chatRooms]
  );
  const messagesAriaLabel = chatUnreadCount > 0
    ? `Messages, ${chatUnreadCount} unread`
    : "Messages";

  const profileImageUrl = user?.profileImageUrl ?? null;
  const showGuideVerifiedBadge = user?.role === "GUIDE" && user.guideProfile?.verifiedBadge === true;

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.username?.trim() || user.email || "User";
  }, [user]);

  const roleLabel = user?.role === "GUIDE"
    ? "Guide"
    : user?.role === "ADMIN"
      ? "Admin"
      : "Adventurer";

  /* ── Computed class strings ── */
  const headerClass = [
    styles.header,
    scrolled ? styles.scrolled : "",
    opaque   ? styles.opaque   : "",
  ].filter(Boolean).join(" ");

  const progressBarClass = [
    styles.progressBar,
    scrolled ? styles.progressBarScrolled : "",
  ].filter(Boolean).join(" ");

  const showProgressBar = typeof stepProgress === "number";

  return (
    <>
      <header className={headerClass}>
        <div className={styles.headerContainer}>

          {/* ── Logo ── */}
          <Link to="/home" className={styles.headerBrand} onClick={closeMobileMenu}>
            <span className={styles.brandAccent}>Un</span>
            <span className={styles.brandText}>Tamed</span>
          </Link>

          {/* ── Center slot: compact search bar ── */}
          <div className={styles.centerSlot}>
            <div
              className={styles.compactSearchWrap}
              style={{
                opacity:       compactSearch ? 1 : 0,
                transform:     compactSearch ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.97)",
                pointerEvents: compactSearch ? "auto" : "none",
              }}
            >
              {compactSearch}
            </div>
          </div>

          {/* ── Right actions ── */}
          <div className={styles.headerActions}>
            {!user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Link to="/login" className={styles.headerLogin}>
                  Log in
                </Link>
                <Link to="/register" className={styles.headerCta}>
                  Get Started
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 12L10 8L6 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            ) : (
              <>
              <div className={styles.notificationWrapper} ref={messagesRef}>
                <button
                  type="button"
                  className={[
                    styles.notificationButton,
                    messagesOpen ? styles.notificationButtonActive : "",
                  ].filter(Boolean).join(" ")}
                  onClick={openMessages}
                  aria-label={messagesAriaLabel}
                  aria-expanded={messagesOpen}
                  aria-haspopup="true"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
                  </svg>
                  {chatUnreadCount > 0 && chatUnreadCount <= 3 && (
                    <span className={styles.notificationDotBadge} aria-hidden="true" />
                  )}
                  {chatUnreadCount > 3 && (
                    <span className={styles.notificationBadge} aria-hidden="true">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  )}
                  {chatUnreadCount > 0 && (
                    <span className={styles.srOnly}>{chatUnreadCount} unread messages</span>
                  )}
                </button>

                {messagesOpen && (
                  <div
                    className={`${styles.notificationDropdown} ${styles.messagesDropdown}`}
                    role="dialog"
                    aria-labelledby="messages-dropdown-title"
                  >
                    <div className={styles.notificationDropdownHeader}>
                      <div>
                        <div className={styles.notificationTitle} id="messages-dropdown-title">Messages</div>
                        {chatUnreadCount > 0 && (
                          <div className={styles.notificationNewChip}>{chatUnreadCount} unread</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.notificationList}>
                      {chatLoading && (
                        Array.from({ length: 4 }).map((_, index) => (
                          <div className={styles.notificationSkeleton} key={index}>
                            <span />
                            <div>
                              <strong />
                              <em />
                            </div>
                          </div>
                        ))
                      )}
                      {!chatLoading && chatError && (
                        <div className={styles.notificationState}>
                          <strong>Could not load messages</strong>
                          <button type="button" onClick={() => loadChatRooms().catch(() => undefined)}>
                            Retry
                          </button>
                        </div>
                      )}
                      {!chatLoading && !chatError && chatRooms.length === 0 && (
                        <div className={styles.notificationEmptyState}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
                          </svg>
                          <strong>No messages yet</strong>
                          <span>Trip group chats will appear here.</span>
                        </div>
                      )}
                      {!chatLoading && !chatError && chatRooms.map((room) => {
                        const title = room.activityTitle || "Session chat";
                        const unread = Math.max(0, room.unreadCount ?? 0);
                        const preview = room.lastMessagePreview || "No messages yet.";
                        const sender = room.lastMessageSenderName ? `${room.lastMessageSenderName}: ` : "";
                        return (
                          <button
                            type="button"
                            className={`${styles.messagePreviewItem} ${unread > 0 ? styles.messagePreviewUnread : ""}`}
                            key={room.id}
                            onClick={() => handleChatClick(room)}
                          >
                            <span className={styles.messagePreviewAvatar}>
                              {room.activityImageUrl ? (
                                <img src={room.activityImageUrl} alt="" />
                              ) : (
                                <span>{title.slice(0, 2).toUpperCase()}</span>
                              )}
                            </span>
                            <span className={styles.messagePreviewBody}>
                              <span className={styles.messagePreviewTitle}>{title}</span>
                              <span className={styles.messagePreviewText}>{sender}{preview}</span>
                            </span>
                            <span className={styles.messagePreviewMeta}>
                              <span>{relativeNotificationTime(room.lastMessageAt ?? room.updatedAt ?? room.createdAt ?? new Date().toISOString())}</span>
                              {unread > 0 && <i aria-hidden="true">{unread > 9 ? "9+" : unread}</i>}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <Link
                      to="/chat"
                      className={styles.notificationViewAll}
                      onClick={() => setMessagesOpen(false)}
                    >
                      View all messages
                    </Link>
                  </div>
                )}
              </div>

              <div className={styles.notificationWrapper} ref={notificationRef}>
                <span className={styles.srOnly} aria-live="polite">
                  {notifications.realtimeAnnouncement ?? ""}
                </span>
                <button
                  type="button"
                  className={[
                    styles.notificationButton,
                    notificationsOpen ? styles.notificationButtonActive : "",
                    bellPulse ? styles.notificationButtonPulse : "",
                  ].filter(Boolean).join(" ")}
                  onClick={openNotifications}
                  aria-label={bellAriaLabel}
                  aria-expanded={notificationsOpen}
                  aria-haspopup="true"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  {notifications.unreadCount > 0 && notifications.unreadCount <= 3 && (
                    <span className={styles.notificationDotBadge} aria-hidden="true" />
                  )}
                  {notifications.unreadCount > 3 && (
                    <span className={styles.notificationBadge} aria-hidden="true">
                      {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                    </span>
                  )}
                  {notifications.unreadCount > 0 && (
                    <span className={styles.srOnly}>
                      {notifications.unreadCount} unread notifications
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    className={styles.notificationDropdown}
                    role="dialog"
                    aria-labelledby="notification-dropdown-title"
                  >
                    <div className={styles.notificationDropdownHeader}>
                      <div>
                        <div className={styles.notificationTitle} id="notification-dropdown-title">Notifications</div>
                        {notifications.unreadCount > 0 && (
                          <div className={styles.notificationNewChip}>
                            {notifications.unreadCount} new
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.notificationTextButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllRead();
                        }}
                        disabled={notifications.unreadCount === 0}
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className={styles.notificationList}>
                      {notifications.latestLoading && (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div className={styles.notificationSkeleton} key={index}>
                            <span />
                            <div>
                              <strong />
                              <em />
                            </div>
                          </div>
                        ))
                      )}
                      {!notifications.latestLoading && notifications.latestError && (
                        <div className={styles.notificationState}>
                          <strong>Could not load notifications</strong>
                          <button type="button" onClick={() => notifications.loadLatest().catch(() => undefined)}>
                            Retry
                          </button>
                        </div>
                      )}
                      {!notifications.latestLoading && !notifications.latestError && notifications.latest.length === 0 && (
                        <div className={styles.notificationEmptyState}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 01-3.46 0" />
                          </svg>
                          <strong>All caught up</strong>
                          <span>No new notifications</span>
                        </div>
                      )}
                      {!notifications.latestLoading && !notifications.latestError && notifications.latest.map((notification) => {
                        const meta = getNotificationMeta(notification);
                        return (
                          <button
                            type="button"
                            key={notification.id}
                            className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ""}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <span className={`${styles.notificationIconTile} ${styles[`tone${meta.tone}`]}`}>
                              <NotificationGlyph icon={meta.icon} />
                            </span>
                            <span className={styles.notificationItemBody}>
                              <span className={styles.notificationMicroLabel}>{meta.categoryLabel}</span>
                              <span className={styles.notificationItemTitle}>{notification.title}</span>
                              <span className={styles.notificationItemMessage}>{notification.message}</span>
                              <span className={styles.notificationItemTime}>{relativeNotificationTime(notification.createdAt)}</span>
                            </span>
                            {!notification.read && <span className={styles.notificationUnreadDot} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>

                    <Link
                      to="/notifications"
                      className={styles.notificationViewAll}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>

              <div className={styles.profileWrapper} ref={dropdownRef}>
                <button
                  className={`${styles.profileButton} ${dropdownOpen ? styles.profileButtonActive : ""}`}
                  onClick={() => {
                    setNotificationsOpen(false);
                    setMessagesOpen(false);
                    setDropdownOpen((v) => !v);
                  }}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt={displayName} className={styles.profileAvatar} />
                  ) : (
                    <div className={styles.profileAvatarPlaceholder}>
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={styles.profileName}>{displayName}</span>
                  {showGuideVerifiedBadge && (
                    <svg className={styles.verifiedBadge} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <svg
                    className={`${styles.chevron} ${dropdownOpen ? styles.chevronUp : ""}`}
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className={styles.dropdown} role="menu">
                    <div className={styles.dropdownHeader}>
                      <div className={styles.dropdownAvatar}>
                        {profileImageUrl ? (
                          <img src={profileImageUrl} alt={displayName} />
                        ) : (
                          <span>{displayName.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div className={styles.dropdownName}>{displayName}</div>
                        <div className={styles.dropdownRole}>{roleLabel}</div>
                      </div>
                    </div>

                    <div className={styles.dropdownDivider} />

                    <Link to="/profile" className={styles.dropdownItem} role="menuitem"
                      onClick={() => setDropdownOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Profile
                    </Link>

                    {user.role === "GUIDE" && (
                      <Link to="/guide" className={styles.dropdownItem} role="menuitem"
                        onClick={() => setDropdownOpen(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Dashboard
                      </Link>
                    )}

                    <Link to="/my-bookings" className={styles.dropdownItem} role="menuitem"
                      onClick={() => setDropdownOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                      </svg>
                      My bookings
                    </Link>

                    <Link to="/chat" className={styles.dropdownItem} role="menuitem"
                      onClick={() => setDropdownOpen(false)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
                      </svg>
                      Chats
                    </Link>

                    <div className={styles.dropdownDivider} />

                    <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`}
                      role="menuitem" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className={`${styles.mobileToggle} ${mobileMenuOpen ? styles.mobileToggleActive : ""}`}
            onClick={toggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          {/* Mobile nav — extend with nav links as needed */}
          <nav
            className={`${styles.headerNav} ${mobileMenuOpen ? styles.active : ""}`}
            aria-label="Mobile navigation"
          />
        </div>
      </header>

      {/* ── Step progress bar ── */}
      {showProgressBar && (
        <div
          className={progressBarClass}
          role="progressbar"
          aria-valuenow={stepProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.progressBarFill}
            style={{ width: `${Math.min(100, Math.max(0, stepProgress!))}%` }}
          />
        </div>
      )}
      {!isChatPage && miniChatRoomId && (
        <MiniChatPopup
          roomId={miniChatRoomId}
          initialRoom={chatRooms.find((room) => room.id === miniChatRoomId) ?? null}
          onClose={() => setMiniChatRoomId(null)}
          onExpand={() => {
            const roomId = miniChatRoomId;
            setMiniChatRoomId(null);
            navigate(`/chat/rooms/${roomId}`);
          }}
        />
      )}
    </>
  );
}
