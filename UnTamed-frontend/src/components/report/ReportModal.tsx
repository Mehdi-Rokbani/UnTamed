import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Flag, X } from "lucide-react";
import { submitReport } from "../../api/reports.api";
import type { ReportReason, ReportResponse, ReportTargetType } from "../../types/report";
import styles from "./ReportModal.module.css";

type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  contextLabel?: string;
  defaultReason?: ReportReason;
  onSubmitted?: (report: ReportResponse) => void;
};

const REASON_LABELS: Record<ReportReason, string> = {
  FAKE_INFORMATION: "Fake or misleading information",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  ABUSE_OR_HARASSMENT: "Abuse or harassment",
  SCAM_OR_FRAUD: "Scam or fraud",
  SAFETY_CONCERN: "Safety concern",
  NO_SHOW: "No-show",
  PAYMENT_OR_BOOKING_ISSUE: "Payment or booking issue",
  SESSION_PROBLEM: "Session problem",
  OTHER: "Other",
};

const REASONS_BY_TARGET: Record<ReportTargetType, ReportReason[]> = {
  GUIDE: ["ABUSE_OR_HARASSMENT", "SCAM_OR_FRAUD", "SAFETY_CONCERN", "INAPPROPRIATE_CONTENT", "OTHER"],
  USER: ["ABUSE_OR_HARASSMENT", "SCAM_OR_FRAUD", "SAFETY_CONCERN", "INAPPROPRIATE_CONTENT", "OTHER"],
  ACTIVITY: ["FAKE_INFORMATION", "INAPPROPRIATE_CONTENT", "SCAM_OR_FRAUD", "SAFETY_CONCERN", "PAYMENT_OR_BOOKING_ISSUE", "OTHER"],
  SESSION: ["NO_SHOW", "SESSION_PROBLEM", "SAFETY_CONCERN", "ABUSE_OR_HARASSMENT", "PAYMENT_OR_BOOKING_ISSUE", "OTHER"],
};

function titleFor(targetType: ReportTargetType) {
  if (targetType === "GUIDE") return "Report guide";
  if (targetType === "ACTIVITY") return "Report activity";
  if (targetType === "SESSION") return "Report session";
  return "Report user";
}

function errorMessage(error: any) {
  const data = error?.response?.data ?? error?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  if (error instanceof Error && error.message) return error.message;
  return "Could not submit the report. Please try again.";
}

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
  contextLabel,
  defaultReason,
  onSubmitted,
}: ReportModalProps) {
  const reasonOptions = useMemo(() => REASONS_BY_TARGET[targetType], [targetType]);
  const initialReason = defaultReason && reasonOptions.includes(defaultReason) ? defaultReason : reasonOptions[0];
  const [reason, setReason] = useState<ReportReason>(initialReason);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ReportResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(initialReason);
    setDescription("");
    setError("");
    setSubmitting(false);
    setSubmitted(null);
  }, [open, initialReason, targetId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitted || submitting) return;

    const trimmed = description.trim();
    setError("");

    if (trimmed.length < 10) {
      setError("Please write at least 10 characters so our team has enough context.");
      return;
    }

    setSubmitting(true);
    try {
      const report = await submitReport({
        targetType,
        targetId,
        reason,
        description: trimmed,
      });
      setSubmitted(report);
      onSubmitted?.(report);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="report-title">
        <button className={styles.closeButton} type="button" onClick={onClose} disabled={submitting} aria-label="Close report dialog">
          <X size={18} />
        </button>

        {submitted ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={28} />
            </div>
            <span className={styles.kicker}>Report submitted</span>
            <h2 id="report-title">Thank you for helping keep UnTamed safe</h2>
            <p>Our team will review your submission and take action if needed.</p>
            <small>Reference: {submitted.id}</small>
            <button className={styles.primaryButton} type="button" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.iconWrap} aria-hidden="true">
                <Flag size={24} />
              </div>
              <div>
                <span className={styles.kicker}>Safety report</span>
                <h2 id="report-title">{titleFor(targetType)}</h2>
                <p>Reports help us keep UnTamed safe. Our team will review your submission.</p>
              </div>
            </div>

            {(targetLabel || contextLabel) && (
              <div className={styles.targetSummary}>
                {targetLabel && <strong>{targetLabel}</strong>}
                {contextLabel && <span>{contextLabel}</span>}
              </div>
            )}

            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.field}>
                <span>Reason</span>
                <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                  {reasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {REASON_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value.slice(0, 2000));
                    setError("");
                  }}
                  minLength={10}
                  maxLength={2000}
                  required
                  placeholder="Describe what happened and include any details that would help moderation."
                />
              </label>

              <div className={styles.metaRow}>
                <span>Minimum 10 characters</span>
                <span>{description.length}/2000</span>
              </div>

              {error && (
                <div className={styles.errorBox} role="alert">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                <button className={styles.primaryButton} type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
