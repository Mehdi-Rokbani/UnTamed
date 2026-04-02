import { useState } from "react";
import type { Review } from "../../types/review";
import styles from "../../style/reviews.module.css";
import RatingStars from "./RatingStars";
import ReviewForm from "./ReviewForm";

type Props = {
  review: Review;
  currentUserId?: string | null;
  guideOwnerId?: string | null;
  onReviewUpdated?: (updated: Review) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (url) {
    return <img src={url} className={styles.avatar} alt={name} />;
  }
  return (
    <div className={styles.avatarFallback} aria-hidden="true">
      {initials || name.charAt(0).toUpperCase()}
    </div>
  );
}

const TRUNCATE_LIMIT = 240;

export default function ReviewCard({
  review,
  currentUserId,
  guideOwnerId,
  onReviewUpdated,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState(review.replyText ?? "");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [localReply, setLocalReply] = useState(review.replyText ?? "");

  const user = review.reviewer;
  const guide = review.guide;

  const isAuthor = !!currentUserId && currentUserId === user?.id;
  const isGuideOwner =
    !!currentUserId && !!guideOwnerId && currentUserId === guideOwnerId;

  const comment = review.comment ?? "";
  const isLong = comment.length > TRUNCATE_LIMIT;
  const displayedComment =
    isLong && !expanded ? comment.slice(0, TRUNCATE_LIMIT).trimEnd() + "…" : comment;

  async function handleReplySave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;
    try {
      setReplySubmitting(true);
      setReplyError("");
      // await replyToReview(review.id, { replyText: trimmed });
      setLocalReply(trimmed);
      setReplyOpen(false);
    } catch (err: any) {
      setReplyError(err?.response?.data?.message || "Failed to save reply.");
    } finally {
      setReplySubmitting(false);
    }
  }

  if (editingReview) {
    return (
      <article className={`${styles.card} ${styles.cardEditing}`}>
        <div className={styles.editingLabel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editing your review
        </div>
        <ReviewForm
          initialRating={review.rating}
          initialComment={review.comment ?? ""}
          submitLabel="Update review"
          onCancel={() => setEditingReview(false)}
          onSubmit={async (data) => {
            // await updateReview(review.id, data);
            onReviewUpdated?.({ ...review, ...data });
            setEditingReview(false);
          }}
          confirmDiscard
        />
      </article>
    );
  }

  return (
    <article
      className={styles.card}
      aria-label={`Review by ${user?.username ?? "Anonymous"}`}
    >
      {/* ── HEADER ── */}
      <div className={styles.cardHeader}>
        <Avatar url={user?.profileImageUrl} name={user?.username || "?"} />
        <div className={styles.userInfo}>
          <div className={styles.usernameRow}>
            <span className={styles.username}>{user?.username ?? "Anonymous"}</span>
            {(review as any).verifiedBooking && (
              <span className={styles.verifiedBadge} title="Verified booking">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Verified
              </span>
            )}
          </div>
          <div className={styles.metaRow}>
            {user?.role && (
              <span className={styles.roleBadge}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()}
              </span>
            )}
            <span className={styles.metaDate}>{formatDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Author actions */}
        {isAuthor && (
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setEditingReview(true)}
            aria-label="Edit your review"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        )}
      </div>

      {/* ── RATING ── */}
      <div className={styles.cardRating}>
        <RatingStars value={review.rating} readonly size="sm" />
        <span className={styles.ratingNumeric}>{review.rating}.0</span>
      </div>

      {/* ── COMMENT ── */}
      <p className={styles.comment}>{displayedComment}</p>
      {isLong && (
        <button
          className={styles.readMoreBtn}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          type="button"
        >
          {expanded ? "Show less" : "Read more"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ── GUIDE REPLY ── */}
      {localReply && (
        <div className={styles.replyBox}>
          <div className={styles.replyHeader}>
            <Avatar url={guide?.profileImageUrl} name={guide?.username || "Guide"} />
            <div className={styles.userInfo}>
              <div className={styles.usernameRow}>
                <span className={styles.username}>{guide?.username || "Guide"}</span>
                <span className={styles.guideBadge}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  Guide
                </span>
              </div>
              <span className={styles.metaDate}>{formatDate(review.replyCreatedAt)}</span>
            </div>
          </div>
          <p className={styles.replyText}>{localReply}</p>
        </div>
      )}

      {/* ── GUIDE REPLY ACTION ── */}
      {isGuideOwner && (
        <button
          type="button"
          className={styles.replyActionBtn}
          onClick={() => {
            setReplyText(localReply);
            setReplyError("");
            setReplyOpen(true);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {localReply ? "Edit reply" : "Reply to review"}
        </button>
      )}

      {/* ── REPLY MODAL ── */}
      {replyOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setReplyOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={localReply ? "Edit your reply" : "Write a reply"}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>
                {localReply ? "Edit your reply" : "Reply to this review"}
              </h4>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setReplyOpen(false)}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Quoted review */}
            <div className={styles.replyQuote}>
              <RatingStars value={review.rating} readonly size="sm" />
              <p className={styles.replyQuoteText}>
                {comment.length > 100 ? comment.slice(0, 100) + "…" : comment}
              </p>
            </div>

            <form onSubmit={handleReplySave}>
              <textarea
                className={styles.replyTextarea}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a thoughtful, professional reply…"
                maxLength={1000}
                disabled={replySubmitting}
                rows={4}
                autoFocus
              />
              <div className={styles.replyTextareaFooter}>
                <span className={styles.charCount}>{replyText.length}/1000</span>
              </div>

              {replyError && (
                <p className={styles.formError} role="alert">{replyError}</p>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setReplyOpen(false)}
                  disabled={replySubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={replySubmitting || !replyText.trim()}
                >
                  {replySubmitting ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    "Save reply"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}