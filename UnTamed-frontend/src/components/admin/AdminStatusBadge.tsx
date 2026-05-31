import styles from "../../style/admin.module.css";

export type AdminStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "DISABLED"
  | "PENDING"
  | "PENDING_VERIFICATION"
  | "DRAFT"
  | "PUBLISHED"
  | "CANCELLED"
  | "COMPLETED"
  | "REFUND_PENDING"
  | "REFUND_FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "NOT_REFUNDABLE"
  | "PENDING_SESSION_COMPLETION"
  | "READY_FOR_PAYOUT"
  | "PAYOUT_SCHEDULED"
  | "PAID"
  | "VOIDED"
  | "CREATED"
  | "FAILED"
  | "APPROVED"
  | "VERIFIED"
  | "REJECTED"
  | "ADMIN"
  | "GUIDE"
  | "ADVENTURER";

const statusClass: Record<AdminStatus, string> = {
  ACTIVE: styles.badgeActive,
  INACTIVE: styles.badgeInactive,
  SUSPENDED: styles.badgeSuspended,
  DISABLED: styles.badgeInactive,
  PENDING: styles.badgePending,
  PENDING_VERIFICATION: styles.badgePending,
  DRAFT: styles.badgePending,
  PUBLISHED: styles.badgeApproved,
  CANCELLED: styles.badgeSuspended,
  COMPLETED: styles.badgeActive,
  REFUND_PENDING: styles.badgePending,
  REFUND_FAILED: styles.badgeSuspended,
  REFUNDED: styles.badgeApproved,
  PARTIALLY_REFUNDED: styles.badgeApproved,
  NOT_REFUNDABLE: styles.badgeInactive,
  PENDING_SESSION_COMPLETION: styles.badgePending,
  READY_FOR_PAYOUT: styles.badgeApproved,
  PAYOUT_SCHEDULED: styles.badgePending,
  PAID: styles.badgeActive,
  VOIDED: styles.badgeInactive,
  CREATED: styles.badgePending,
  FAILED: styles.badgeSuspended,
  APPROVED: styles.badgeApproved,
  VERIFIED: styles.badgeApproved,
  REJECTED: styles.badgeRejected,
  ADMIN: styles.badgeAdmin,
  GUIDE: styles.badgeGuide,
  ADVENTURER: styles.badgeAdventurer,
};

export default function AdminStatusBadge({ status }: { status: AdminStatus }) {
  return <span className={`${styles.badge} ${statusClass[status]}`}>{status}</span>;
}
