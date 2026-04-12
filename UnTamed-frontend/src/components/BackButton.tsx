import { useLocation, useNavigate } from "react-router-dom";
import styles from "../style/backButton.module.css";

interface BackButtonProps {
  to?: string;
  variant?: "default" | "ghost" | "filled";
}

type BackButtonLocationState = {
  from?: string;
};

export function BackButton({ to, variant = "default" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as BackButtonLocationState | null) ?? null;
  const from = state?.from;

  const handleBack = () => {
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (to) {
      navigate(to, { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[variant]}`}
      onClick={handleBack}
      aria-label="Go back"
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
    </button>
  );
}