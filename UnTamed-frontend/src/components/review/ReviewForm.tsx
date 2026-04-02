import { useRef, useState } from "react";
import styles from "../../style/reviews.module.css";
import RatingStars from "./RatingStars";

type ReviewFormData = {
  rating: number;
  comment: string;
};

type Props = {
  initialRating?: number;
  initialComment?: string;
  submitLabel?: string;
  onSubmit: (data: ReviewFormData) => Promise<void>;
  onCancel?: () => void;
  confirmDiscard?: boolean;
};

const MIN_COMMENT = 20;
const MAX_COMMENT = 1000;

export default function ReviewForm({
  initialRating = 0,
  initialComment = "",
  submitLabel = "Submit review",
  onSubmit,
  onCancel,
  confirmDiscard = false,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commentTooShort = comment.trim().length > 0 && comment.trim().length < MIN_COMMENT;
  const canSubmit = rating > 0 && comment.trim().length >= MIN_COMMENT && !submitting;

  function handleCancel() {
    const isDirty = rating !== initialRating || comment !== initialComment;
    if (confirmDiscard && isDirty) {
      if (!window.confirm("Discard your changes?")) return;
    }
    onCancel?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError("");
      await onSubmit({ rating, comment: comment.trim() });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={styles.successState} role="status" aria-live="polite">
        <div className={styles.successIcon} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <p className={styles.successTitle}>Review submitted!</p>
        <p className={styles.successSubtitle}>Thank you for sharing your experience.</p>
      </div>
    );
  }

  return (
    <form className={styles.reviewForm} onSubmit={handleSubmit} noValidate>
      {/* Rating */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>
          Your rating
          <span className={styles.formRequired} aria-hidden="true"> *</span>
        </label>
        <RatingStars
          value={rating}
          onChange={setRating}
          size="lg"
          showLabel
        />
        {rating === 0 && (
          <p className={styles.formHint}>Tap a star to rate</p>
        )}
      </div>

      {/* Comment */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="review-comment">
          Your review
          <span className={styles.formRequired} aria-hidden="true"> *</span>
        </label>
        <div className={`${styles.textareaWrapper} ${commentTooShort ? styles.textareaError : ""}`}>
          <textarea
            id="review-comment"
            ref={textareaRef}
            className={styles.textarea}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you enjoy? What would you recommend to others?"
            maxLength={MAX_COMMENT}
            rows={5}
            disabled={submitting}
            aria-describedby="comment-hint"
          />
        </div>
        <div className={styles.textareaFooterRow} id="comment-hint">
          {commentTooShort ? (
            <span className={styles.formErrorInline} role="alert">
              Please write at least {MIN_COMMENT} characters.
            </span>
          ) : (
            <span className={styles.formHint}>
              {comment.length === 0
                ? `Minimum ${MIN_COMMENT} characters`
                : `${comment.trim().length} characters`}
            </span>
          )}
          <span className={`${styles.charCount} ${comment.length > MAX_COMMENT * 0.9 ? styles.charCountWarn : ""}`}>
            {comment.length}/{MAX_COMMENT}
          </span>
        </div>
      </div>

      {error && (
        <div className={styles.formError} role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className={styles.formActions}>
        {onCancel && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={!canSubmit}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Submitting…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}