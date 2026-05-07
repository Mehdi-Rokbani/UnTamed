import { useLocation, useNavigate } from "react-router-dom";
import styles from "../style/backButton.module.css";

interface BackButtonProps {
  fallbackTo?: string;
  label?: string;
  className?: string;
  variant?: "plain" | "ghost" | "card" | "default" | "filled";
  ariaLabel?: string;
  to?: string;
}

type BackButtonLocationState = {
  from?: string;
};

function variantClassName(variant: BackButtonProps["variant"]) {
  if (variant === "default") return "card";
  if (variant === "filled") return "ghost";
  return variant ?? "card";
}

export function BackButton({
  fallbackTo,
  label,
  className,
  variant = "card",
  ariaLabel = "Go back",
  to,
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as BackButtonLocationState | null) ?? null;
  const from = state?.from;
  const fallback = fallbackTo ?? to ?? "/";
  const hasInAppHistory = location.key !== "default" && window.history.length > 1;

  const handleBack = () => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    if (hasInAppHistory) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[variantClassName(variant)]} ${label ? styles.withLabel : ""} ${className ?? ""}`}
      onClick={handleBack}
      aria-label={ariaLabel}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 5l-7 7 7 7" />
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
}
