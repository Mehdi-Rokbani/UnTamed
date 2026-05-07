import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { BackButton } from "../components/BackButton";
import * as NotificationApi from "../api/notification.api";
import { useNotifications } from "../hooks/useNotifications";
import type { Notification } from "../types/notification";
import type { PaginatedResponse } from "../types/pagination";
import {
  absoluteNotificationTime,
  getNotificationMeta,
  notificationGroupLabel,
  notificationMatchesFilter,
  NOTIFICATION_FILTERS,
  NotificationGlyph,
  relativeNotificationTime,
  type NotificationFilter,
} from "../utils/notificationUi";
import styles from "../style/notifications.module.css";

const PAGE_SIZE = 20;

function mergeById(existing: Notification[], incoming: Notification[]) {
  const seen = new Set<string>();
  return [...existing, ...incoming].filter((notification) => {
    if (seen.has(notification.id)) return false;
    seen.add(notification.id);
    return true;
  });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const notificationState = useNotifications();
  const [page, setPage] = useState<PaginatedResponse<Notification> | null>(null);
  const [pageNumber, setPageNumber] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await NotificationApi.listNotifications(pageNumber, PAGE_SIZE);
        if (!alive) return;
        notificationState.syncNotifications(data.content ?? []);
        setPage((prev) => pageNumber === 0
          ? data
          : {
              ...data,
              content: mergeById(prev?.content ?? [], data.content ?? []),
            });
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load notifications");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [notificationState.syncNotifications, pageNumber]);

  const visibleNotifications = useMemo(() => {
    const items = page?.content ?? [];
    return items.filter((item) => notificationMatchesFilter(item, filter));
  }, [filter, page?.content]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<"Today" | "Yesterday" | "Earlier", Notification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    for (const notification of visibleNotifications) {
      groups[notificationGroupLabel(notification)].push(notification);
    }

    return groups;
  }, [visibleNotifications]);

  const unreadOnPage = useMemo(
    () => (page?.content ?? []).some((item) => !item.read),
    [page?.content]
  );

  const handleOpen = async (notification: Notification) => {
    let item = notification;
    if (!notification.read) {
      item = await notificationState.markRead(notification);
      setPage((prev) => prev
        ? {
            ...prev,
            content: prev.content.map((candidate) => candidate.id === item.id ? item : candidate),
          }
        : prev);
    }

    if (item.actionUrl?.startsWith("/")) {
      navigate(item.actionUrl);
    }
  };

  const handleMarkRead = async (notification: Notification) => {
    const updated = await notificationState.markRead(notification);
    setPage((prev) => prev
      ? {
          ...prev,
          content: prev.content.map((item) => item.id === updated.id ? updated : item),
        }
      : prev);
  };

  const handleMarkAllRead = async () => {
    await notificationState.markAllRead();
    setPage((prev) => prev
      ? {
          ...prev,
          content: prev.content.map((item) => ({
            ...item,
            read: true,
            readAt: item.readAt ?? new Date().toISOString(),
          })),
        }
      : prev);
  };

  const handleDelete = async (notification: Notification) => {
    await notificationState.removeNotification(notification.id, !notification.read);
    setPage((prev) => prev
      ? {
          ...prev,
          content: prev.content.filter((item) => item.id !== notification.id),
          totalElements: Math.max(0, prev.totalElements - 1),
        }
      : prev);
  };

  return (
    <>
      <Header opaque />
      <main className={styles.page}>
        <div className={styles.shell}>
          <BackButton fallbackTo="/home" variant="plain" />

          <section className={styles.hero}>
            <div>
              <h1>Notifications</h1>
              <p>Updates about bookings, sessions, reviews, refunds, and account activity.</p>
            </div>
            <div className={styles.heroActions}>
              <span className={styles.countPill}>{notificationState.unreadCount} unread</span>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleMarkAllRead}
              disabled={!unreadOnPage && notificationState.unreadCount === 0}
            >
              Mark all read
            </button>
            </div>
          </section>

          <div className={styles.toolbar}>
            <div className={styles.filterChips} aria-label="Notification filter">
              {NOTIFICATION_FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={filter === item ? styles.filterChipActive : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <section className={styles.list} aria-busy={loading}>
            {loading && pageNumber === 0 && (
              Array.from({ length: 4 }).map((_, index) => (
                <div className={styles.skeleton} key={index} />
              ))
            )}

            {!loading && visibleNotifications.length === 0 && !error && (
              <div className={styles.empty}>
                <h2>No notifications yet</h2>
                <p>Updates about bookings, sessions, reviews, and refunds will appear here.</p>
              </div>
            )}

            {(["Today", "Yesterday", "Earlier"] as const).map((group) => (
              groupedNotifications[group].length > 0 && (
                <section className={styles.group} key={group} aria-label={group}>
                  <h2>{group}</h2>
                  <div className={styles.groupList}>
                    {groupedNotifications[group].map((notification) => {
                      const meta = getNotificationMeta(notification);
                      return (
                        <article
                          key={notification.id}
                          className={`${styles.item} ${!notification.read ? styles.itemUnread : ""}`}
                        >
                          <div className={`${styles.iconTile} ${styles[`tone${meta.tone}`]}`}>
                            <NotificationGlyph icon={meta.icon} />
                          </div>

                          <div className={styles.itemContent}>
                            <div className={styles.itemTopline}>
                              <span className={styles.itemMeta}>{meta.categoryLabel}</span>
                              <span className={styles.itemTime} title={absoluteNotificationTime(notification.createdAt)}>
                                {relativeNotificationTime(notification.createdAt)}
                              </span>
                            </div>
                            <h3 className={styles.itemTitle}>{notification.title}</h3>
                            <p className={styles.itemMessage}>{notification.message}</p>
                            <span className={styles.statusLabel}>{meta.statusLabel}</span>
                          </div>

                          <div className={styles.itemActions}>
                            {notification.actionUrl && (
                              <button type="button" className={styles.actionPrimary} onClick={() => handleOpen(notification)}>
                                {meta.actionLabel}
                              </button>
                            )}
                            {!notification.read && (
                              <button type="button" className={styles.actionText} onClick={() => handleMarkRead(notification)}>
                                Mark read
                              </button>
                            )}
                            <button type="button" className={styles.actionText} onClick={() => handleDelete(notification)}>
                              Remove
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )
            ))}
          </section>

          {page && !page.last && filter === "All" && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={styles.loadMore}
                onClick={() => setPageNumber((current) => current + 1)}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
