import { useId } from "react";
import styles from "../../style/chat-assistant-widget.module.css";

type AssistantMascotProps = {
  size?: number;
  active?: boolean;
  className?: string;
};

export default function AssistantMascot({ size = 72, active = false, className = "" }: AssistantMascotProps) {
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const bodyGradientId = `${gradientId}-trail-guide-body`;
  const faceGradientId = `${gradientId}-trail-guide-face`;

  return (
    <svg
      className={`${styles.mascot} ${active ? styles.mascotActive : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Trail Guide robot mascot"
    >
      <defs>
        <linearGradient id={bodyGradientId} x1="24" y1="52" x2="72" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1f6040" />
          <stop offset="1" stopColor="#123d28" />
        </linearGradient>
        <linearGradient id={faceGradientId} x1="22" y1="24" x2="74" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffaf1" />
          <stop offset="1" stopColor="#eadfc8" />
        </linearGradient>
      </defs>

      <g className={styles.mascotFloat}>
        <ellipse cx="48" cy="88" rx="25" ry="5" fill="rgba(18,61,40,.18)" />

        <path d="M25 66c0-10 8-18 18-18h10c10 0 18 8 18 18v18H25V66z" fill={`url(#${bodyGradientId})`} />
        <path d="M36 51l24 33" stroke="#f4c06a" strokeWidth="4" strokeLinecap="round" opacity=".9" />
        <circle cx="66" cy="68" r="7" fill="#f4c06a" />
        <path d="M23 70c-7 0-10-5-8-10 2-4 7-5 11-2" fill="none" stroke="#1a4d2e" strokeWidth="6" strokeLinecap="round" />
        <path d="M73 58c5-3 10-2 11 3 2 5-2 9-8 9" fill="none" stroke="#1a4d2e" strokeWidth="6" strokeLinecap="round" />

        <g className={styles.mascotHead}>
          <rect x="21" y="26" width="54" height="42" rx="16" fill={`url(#${faceGradientId})`} stroke="#123d28" strokeWidth="3" />
          <rect x="28" y="34" width="40" height="27" rx="12" fill="#173d2b" />
          <circle cx="40" cy="47" r="4" fill="#f4c06a" />
          <circle cx="56" cy="47" r="4" fill="#f4c06a" />
          <path d="M42 56c4 3 9 3 13 0" fill="none" stroke="#fffaf1" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M48 24V13" stroke="#1a4d2e" strokeWidth="4" strokeLinecap="round" />
          <circle cx="48" cy="11" r="4" fill="#ff8c42" />
        </g>

        <g className={styles.mascotHat}>
          <path d="M25 29c7-13 17-18 33-14 9 2 14 8 17 16-16-5-33-6-50-2z" fill="#8a5a2b" stroke="#5e371b" strokeWidth="2" />
          <path d="M17 33c20-7 42-7 62 0 2 1 2 5-1 6-19 5-39 5-59 0-3-1-4-5-2-6z" fill="#a96d35" stroke="#5e371b" strokeWidth="2" />
          <path d="M42 15c4 6 6 12 5 18" stroke="#f4c06a" strokeWidth="3" strokeLinecap="round" opacity=".85" />
        </g>

        {!active && <circle className={styles.mascotPulseDot} cx="75" cy="24" r="6" fill="#ff6b35" />}
      </g>
    </svg>
  );
}
