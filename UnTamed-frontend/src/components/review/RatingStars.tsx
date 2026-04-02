import { useState } from "react";
import styles from "../../style/reviews.module.css";

type Props = {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function RatingStars({
  value,
  onChange,
  readonly = false,
  size = "md",
  showLabel = false,
}: Props) {
  const [hovered, setHovered] = useState(0);

  const active = hovered || value;
  const isInteractive = !readonly && !!onChange;

  const dims = { sm: 14, md: 20, lg: 28 }[size];

  return (
    <div className={styles.ratingStarsWrapper}>
      <div
        className={`${styles.ratingStars} ${isInteractive ? styles.ratingStarsInteractive : ""}`}
        role={isInteractive ? "radiogroup" : undefined}
        aria-label={isInteractive ? "Rate this activity" : `${value} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          const filled = n <= active;
          return (
            <button
              key={n}
              type="button"
              role={isInteractive ? "radio" : undefined}
              aria-checked={isInteractive ? value === n : undefined}
              aria-label={isInteractive ? `${n} star${n > 1 ? "s" : ""}` : undefined}
              disabled={!isInteractive}
              className={`${styles.starBtn} ${filled ? styles.starBtnFilled : ""} ${
                isInteractive ? styles.starBtnClickable : ""
              }`}
              onMouseEnter={() => isInteractive && setHovered(n)}
              onMouseLeave={() => isInteractive && setHovered(0)}
              onClick={() => isInteractive && onChange?.(n)}
              tabIndex={isInteractive ? 0 : -1}
            >
              <svg
                width={dims}
                height={dims}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  className={filled ? styles.starPolyFilled : styles.starPolyEmpty}
                />
              </svg>
            </button>
          );
        })}
      </div>
      {showLabel && isInteractive && (
        <span
          className={`${styles.ratingLabel} ${active > 0 ? styles.ratingLabelVisible : ""}`}
          aria-live="polite"
        >
          {LABELS[active] ?? ""}
        </span>
      )}
    </div>
  );
}