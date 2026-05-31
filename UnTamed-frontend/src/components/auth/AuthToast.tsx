import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";

import styles from "./AuthToast.module.css";

type AuthToastTone = "error" | "success";

type AuthToastProps = {
  message: string | null;
  tone?: AuthToastTone;
  title?: string;
  onClose: () => void;
};

export function AuthToast({ message, tone = "error", title, onClose }: AuthToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 5200);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`${styles.toast} ${styles[tone]}`} role="alert" aria-live="assertive">
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className={styles.content}>
        <strong>{title || (tone === "success" ? "Success" : "Could not continue")}</strong>
        <span>{message}</span>
      </span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss message">
        <X size={16} />
      </button>
    </div>
  );
}
