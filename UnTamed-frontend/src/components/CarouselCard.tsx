import { Link } from "react-router-dom";
import type { PublicTemplateCard } from "../types/activity";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPrice(price: number) {
  return price === 0 ? "Free" : `${price} TND`;
}

const DIFF: Record<string, { bg: string; color: string; label: string }> = {
  EASY:   { bg: "#dcfce7", color: "#166534", label: "Easy" },
  MEDIUM: { bg: "#fef9c3", color: "#854d0e", label: "Medium" },
  HARD:   { bg: "#fee2e2", color: "#991b1b", label: "Hard" },
};

const GRADIENTS = [
  "linear-gradient(135deg,#1a4d2e,#4d7c3f)",
  "linear-gradient(135deg,#2d5f3e,#ff8c42)",
  "linear-gradient(135deg,#1a3a4d,#2d7c6e)",
  "linear-gradient(135deg,#4d2e1a,#c4713a)",
  "linear-gradient(135deg,#2e1a4d,#7c3f7a)",
  "linear-gradient(135deg,#1a4d3e,#38a87a)",
];

function getBg(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[h % GRADIENTS.length];
}

export function CarouselCard({ activity }: { activity: PublicTemplateCard }) {
  const { id, title, difficulty, price, coverImageUrl, rating, nextSession } = activity;
  const avg = Number(rating?.average ?? 0);
  const cnt = Number(rating?.count ?? 0);
  const dk = (difficulty ?? "EASY").toUpperCase() as keyof typeof DIFF;
  const diff = DIFF[dk] ?? DIFF.EASY;
  const bgStyle = coverImageUrl
    ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: getBg(id) };

  return (
    <Link
      to={`/activities/${id}`}
      style={{
        flex: "0 0 200px",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--card-bg, #fff)",
        border: "0.5px solid rgba(0,0,0,0.1)",
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        transition: "transform .2s, box-shadow .2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 28px rgba(0,0,0,.1)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Image */}
      <div style={{ height: 130, position: "relative", overflow: "hidden", flexShrink: 0, ...bgStyle }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.4) 100%)",
          pointerEvents: "none",
        }} />
        <span style={{
          position: "absolute", top: 8, left: 8, zIndex: 2,
          background: diff.bg, color: diff.color,
          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
        }}>
          {diff.label}
        </span>
        <span style={{
          position: "absolute", bottom: 8, right: 8, zIndex: 2,
          background: "rgba(0,0,0,.65)", color: "#fff",
          fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 7,
        }}>
          {formatPrice(Number(price ?? 0))}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3,
        }}>
          {title}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: "auto", paddingTop: 8,
          borderTop: "0.5px solid rgba(0,0,0,0.07)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500 }}>
            <span style={{ color: "#f59e0b" }}>★</span>
            <span style={{ color: "var(--color-text-primary)" }}>
              {avg > 0 ? avg.toFixed(1) : "New"}
            </span>
            {cnt > 0 && (
              <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>({cnt})</span>
            )}
          </div>
          {nextSession?.date && (
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              {formatDate(nextSession.date)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
