import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import * as GuestPassApi from "../api/guestPass.api";
import type { VerifyGuestPassResponse } from "../api/guestPass.api";
import styles from "../style/guest-pass.module.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortId(id?: string | null): string {
  if (!id) return "N/A";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function guideQrUrl(token: string): string {
  if (typeof window === "undefined") return `/guide/check-in/${token}`;
  return `${window.location.origin}/guide/check-in/${token}`;
}

function passStatusLabel(pass: VerifyGuestPassResponse): "ACTIVE" | "PRESENT" | "ABSENT" | "CANCELLED" {
  if (pass.passStatus === "CANCELLED") return "CANCELLED";
  if (pass.attendanceStatus === "PRESENT") return "PRESENT";
  if (pass.attendanceStatus === "ABSENT") return "ABSENT";
  return "ACTIVE";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuestPassPage() {
  const { token } = useParams();
  const [pass, setPass] = useState<VerifyGuestPassResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) { setError("Missing pass token."); setState("error"); return; }
    setState("loading");
    setError("");
    try {
      const data = await GuestPassApi.getPublicGuestPass(token);
      setPass(data);
      setState(data.valid ? "ready" : "error");
      if (!data.valid) setError(data.message || "This pass is not valid.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load this guest pass.");
      setState("error");
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleDownload() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    // Build a bordered, branded PNG
    const SIZE = 480;
    const PAD  = 32;
    const out  = document.createElement("canvas");
    out.width  = SIZE;
    out.height = SIZE + 80;
    const ctx  = out.getContext("2d")!;

    // Background
    ctx.fillStyle = "#f4f1ea";
    ctx.roundRect(0, 0, out.width, out.height, 20);
    ctx.fill();

    // QR (centered)
    const qrSize = SIZE - PAD * 2;
    ctx.drawImage(canvas, PAD, PAD, qrSize, qrSize);

    // Branding footer
    ctx.fillStyle = "#6b7280";
    ctx.font = "bold 14px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${pass?.activityTitle ?? "Untamed"} · ${formatDate(pass?.sessionStartAt)} · ${shortId(token)}`,
      SIZE / 2,
      SIZE + 52,
    );

    const link = document.createElement("a");
    link.download = `untamed-pass-${shortId(token)}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `${pass?.activityTitle ?? "Untamed"} — Guest pass`,
        text:  `${pass?.guestName ?? "Guest"}'s pass for ${formatDate(pass?.sessionStartAt)}`,
        url,
      }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      alert("Pass link copied to clipboard.");
    }
  }

  function handleAddToWallet() {
    // Placeholder — wire up to Apple / Google Wallet API when available
    alert("Wallet integration coming soon.");
  }

  // ─── Status class helper ─────────────────────────────────────────────────

  function statusClass(label: ReturnType<typeof passStatusLabel>) {
    const map = {
      ACTIVE:    styles.statusACTIVE,
      PRESENT:   styles.statusPRESENT,
      ABSENT:    styles.statusABSENT,
      CANCELLED: styles.statusCANCELLED,
    } as const;
    return `${styles.status} ${map[label] ?? ""}`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      <div className={styles.card}>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {state === "loading" && (
          <div className={styles.stateCard}>
            <div className={styles.loadingSpinner} />
            <p className={styles.stateMessage}>Loading your pass…</p>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {state === "error" && (
          <div className={styles.stateCard}>
            <span className={`${styles.status} ${styles.statusCANCELLED}`}>Invalid pass</span>
            <h1 className={styles.stateTitle}>Pass unavailable</h1>
            <p className={styles.stateMessage}>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={load}>
              Try again
            </button>
          </div>
        )}

        {/* ── Ready ─────────────────────────────────────────────────────── */}
        {state === "ready" && pass && token && (() => {
          const label = passStatusLabel(pass);
          return (
            <>
              {/* LEFT — Info panel */}
              <section className={styles.info}>

                {/* Brand */}
                <Link to="/" className={styles.brand}>
                  <span className={styles.brandAccent}>Un</span>Tamed
                </Link>

                {/* Type + Status */}
                <div className={styles.topline}>
                  <span className={styles.passTypeLabel}>Adventure pass</span>
                  <span className={statusClass(label)}>{label}</span>
                </div>

                {/* Activity title */}
                <h1 className={styles.activityTitle}>
                  {pass.activityTitle ?? "Untamed adventure"}
                </h1>

                {/* Date / Time */}
                <div className={styles.whenRow}>
                  <span className={styles.whenDate}>{formatDate(pass.sessionStartAt)}</span>
                  <div className={styles.whenSep} />
                  <span className={styles.whenTime}>{formatTime(pass.sessionStartAt)}</span>
                </div>

                {/* Guest name */}
                <div className={styles.guestBlock}>
                  <div className={styles.guestBlockLabel}>
                    {pass.mainBooker ? "Main booker" : "Guest"}
                  </div>
                  <div className={styles.guestBlockName}>
                    {pass.guestName ?? "Guest"}
                  </div>
                </div>

                {/* Pass number */}
                <span className={styles.passBadge}>
                  ◈ Guest pass {pass.passNumber} of {pass.totalPasses}
                </span>

                <div className={styles.infoSpacer} />

                {/* Action buttons */}
                <div className={styles.actions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleDownload}>
                    ↓ &nbsp;Download pass
                  </button>
                  <div className={styles.btnRow}>
                    <button type="button" className={styles.btnSecondary} onClick={handleAddToWallet}>
                      ⊛ &nbsp;Add to Wallet
                    </button>
                    <button type="button" className={styles.btnSecondary} onClick={handleShare}>
                      ↗ &nbsp;Share pass
                    </button>
                  </div>
                </div>

                {/* Booking refs */}
                <div className={styles.refs}>
                  <span>Booking #{shortId(pass.bookingId)}</span>
                  <code className={styles.refCode}>{shortId(token)}</code>
                </div>
              </section>

              {/* DASHED DIVIDER */}
              <div className={styles.divider} aria-hidden />

              {/* RIGHT — QR panel */}
              <section className={styles.qrPanel}>
                {label === "ACTIVE" && (
                  <div className={styles.validChip}>
                    <div className={styles.validDot} />
                    Valid for check-in
                  </div>
                )}

                <span className={styles.scanLabel}>Scan at the trailhead</span>

                <div className={styles.qrFrame} ref={qrRef}>
                  <div className={`${styles.qrCorner} ${styles.qrCornerTL}`} />
                  <div className={`${styles.qrCorner} ${styles.qrCornerTR}`} />
                  <div className={`${styles.qrCorner} ${styles.qrCornerBL}`} />
                  <div className={`${styles.qrCorner} ${styles.qrCornerBR}`} />
                  <QRCodeCanvas
                    className={styles.qrCanvas}
                    value={guideQrUrl(token)}
                    size={460}        /* high-res canvas → CSS-scaled down */
                    includeMargin
                    level="H"         /* error-correction HIGH — more robust in sun */
                    bgColor="#ffffff"
                    fgColor="#111827"
                  />
                </div>

                <p className={styles.scanHint}>
                  Show this QR code to your guide at the trail check-in point.
                </p>

                <div className={styles.passNotes}>
                  <span>Valid for one person only</span>
                  <span>No account needed — just show the QR</span>
                </div>
              </section>
            </>
          );
        })()}
      </div>
    </main>
  );
}
