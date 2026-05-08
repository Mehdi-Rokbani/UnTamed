export type NotificationType =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "SESSION_RESCHEDULED"
  | "SESSION_CANCELLED"
  | "SESSION_DELAYED"
  | "ATTENDANCE_MARKED_PRESENT"
  | "ATTENDANCE_MARKED_ABSENT"
  | "REVIEW_AVAILABLE"
  | "GUIDE_REVIEW_RECEIVED"
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "CHAT_MESSAGE"
  | "SYSTEM";

export type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  readAt: string | null;
  actionUrl: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
};
