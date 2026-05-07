import type React from "react";
import type { Notification, NotificationSeverity, NotificationType } from "../types/notification";

type Tone = "success" | "info" | "warning" | "error";

export type NotificationMeta = {
  categoryLabel: string;
  statusLabel: string;
  tone: Tone;
  icon: string;
  actionLabel: string;
};

const TYPE_META: Record<NotificationType, Omit<NotificationMeta, "actionLabel">> = {
  BOOKING_CONFIRMED: {
    categoryLabel: "Booking",
    statusLabel: "Confirmed",
    tone: "success",
    icon: "calendar-check",
  },
  BOOKING_CREATED: {
    categoryLabel: "Booking",
    statusLabel: "New booking",
    tone: "success",
    icon: "calendar-plus",
  },
  SESSION_RESCHEDULED: {
    categoryLabel: "Session update",
    statusLabel: "Rescheduled",
    tone: "warning",
    icon: "clock",
  },
  SESSION_CANCELLED: {
    categoryLabel: "Session update",
    statusLabel: "Cancelled",
    tone: "error",
    icon: "calendar-x",
  },
  SESSION_DELAYED: {
    categoryLabel: "Session update",
    statusLabel: "Delayed",
    tone: "warning",
    icon: "clock",
  },
  ATTENDANCE_MARKED_PRESENT: {
    categoryLabel: "Attendance",
    statusLabel: "Present",
    tone: "success",
    icon: "user-check",
  },
  ATTENDANCE_MARKED_ABSENT: {
    categoryLabel: "Attendance",
    statusLabel: "Absent",
    tone: "warning",
    icon: "user-x",
  },
  REVIEW_AVAILABLE: {
    categoryLabel: "Review",
    statusLabel: "Review",
    tone: "info",
    icon: "star",
  },
  GUIDE_REVIEW_RECEIVED: {
    categoryLabel: "Review",
    statusLabel: "Guide review",
    tone: "success",
    icon: "star",
  },
  REFUND_REQUESTED: {
    categoryLabel: "Payment",
    statusLabel: "Refund requested",
    tone: "info",
    icon: "receipt",
  },
  REFUND_APPROVED: {
    categoryLabel: "Payment",
    statusLabel: "Refund approved",
    tone: "success",
    icon: "receipt",
  },
  REFUND_REJECTED: {
    categoryLabel: "Payment",
    statusLabel: "Refund declined",
    tone: "warning",
    icon: "receipt-off",
  },
  PAYMENT_SUCCESS: {
    categoryLabel: "Payment",
    statusLabel: "Paid",
    tone: "success",
    icon: "credit-card",
  },
  PAYMENT_FAILED: {
    categoryLabel: "Payment",
    statusLabel: "Payment failed",
    tone: "error",
    icon: "credit-card",
  },
  SYSTEM: {
    categoryLabel: "Account",
    statusLabel: "Account",
    tone: "info",
    icon: "bell",
  },
};

const SEVERITY_TONE: Record<NotificationSeverity, Tone> = {
  SUCCESS: "success",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
};

export const NOTIFICATION_FILTERS = [
  "All",
  "Unread",
  "Bookings",
  "Sessions",
  "Payments",
  "Reviews",
  "Attendance",
  "Account",
] as const;

export type NotificationFilter = typeof NOTIFICATION_FILTERS[number];

export function getNotificationMeta(notification: Notification): NotificationMeta {
  const base = TYPE_META[notification.type] ?? {
    categoryLabel: "Account",
    statusLabel: "Account",
    tone: SEVERITY_TONE[notification.severity] ?? "info",
    icon: "bell",
  };

  return {
    ...base,
    actionLabel: actionLabelFor(notification),
  };
}

export function notificationMatchesFilter(notification: Notification, filter: NotificationFilter): boolean {
  if (filter === "All") return true;
  if (filter === "Unread") return !notification.read;

  const category = getNotificationMeta(notification).categoryLabel;
  if (filter === "Bookings") return category === "Booking";
  if (filter === "Sessions") return category === "Session update";
  if (filter === "Payments") return category === "Payment";
  if (filter === "Reviews") return category === "Review";
  if (filter === "Attendance") return category === "Attendance";
  if (filter === "Account") return category === "Account";
  return true;
}

export function relativeNotificationTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute));
    return `${minutes} min ago`;
  }

  if (isYesterday(date, now)) return "Yesterday";
  if (isSameDay(date, now)) {
    const hours = Math.max(1, Math.floor(diffMs / hour));
    return `${hours} hr ago`;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function absoluteNotificationTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function notificationGroupLabel(notification: Notification): "Today" | "Yesterday" | "Earlier" {
  const date = new Date(notification.createdAt);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return "Earlier";
  if (isSameDay(date, now)) return "Today";
  if (isYesterday(date, now)) return "Yesterday";
  return "Earlier";
}

export function NotificationGlyph({ icon }: { icon: string }) {
  if (icon === "calendar-check") return <IconCalendarCheck />;
  if (icon === "calendar-plus") return <IconCalendarPlus />;
  if (icon === "calendar-x") return <IconCalendarX />;
  if (icon === "clock") return <IconClock />;
  if (icon === "user-check") return <IconUserCheck />;
  if (icon === "user-x") return <IconUserX />;
  if (icon === "star") return <IconStar />;
  if (icon === "receipt") return <IconReceipt />;
  if (icon === "receipt-off") return <IconReceiptOff />;
  if (icon === "credit-card") return <IconCreditCard />;
  return <IconBell />;
}

function actionLabelFor(notification: Notification): string {
  const category = TYPE_META[notification.type]?.categoryLabel;
  if (category === "Booking" || category === "Payment" || category === "Attendance") return "View booking";
  if (category === "Session update") return "View session";
  if (category === "Review") return "View review";
  return "View details";
}

function isSameDay(date: Date, now: Date) {
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function BaseIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconBell() {
  return <BaseIcon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></BaseIcon>;
}

function IconCalendarCheck() {
  return <BaseIcon><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-5" /></BaseIcon>;
}

function IconCalendarPlus() {
  return <BaseIcon><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="M12 14v5" /><path d="M9.5 16.5h5" /></BaseIcon>;
}

function IconCalendarX() {
  return <BaseIcon><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m10 14 4 4" /><path d="m14 14-4 4" /></BaseIcon>;
}

function IconClock() {
  return <BaseIcon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></BaseIcon>;
}

function IconUserCheck() {
  return <BaseIcon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></BaseIcon>;
}

function IconUserX() {
  return <BaseIcon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m17 8 4 4" /><path d="m21 8-4 4" /></BaseIcon>;
}

function IconStar() {
  return <BaseIcon><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3z" /></BaseIcon>;
}

function IconReceipt() {
  return <BaseIcon><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></BaseIcon>;
}

function IconReceiptOff() {
  return <BaseIcon><path d="m3 3 18 18" /><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V6" /><path d="M8 8h1" /><path d="M12 8h4" /><path d="M8 12h4" /></BaseIcon>;
}

function IconCreditCard() {
  return <BaseIcon><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M7 15h3" /></BaseIcon>;
}
