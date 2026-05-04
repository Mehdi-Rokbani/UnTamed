import { useRef, useCallback, useEffect, useState } from "react";
import type { RecommendationItem, SimilarActivityItem } from "../types/recommendation";
import type { PublicTemplateCard } from "../types/activity";
import { CarouselCard } from "./CarouselCard";

type SuggestionItem = RecommendationItem | SimilarActivityItem;

function mapToCard(item: SuggestionItem): PublicTemplateCard {
  return {
    id: item.templateId,
    title: item.title,
    description: item.description,
    difficulty: item.difficulty ?? "EASY",
    price: item.price ?? 0,
    coverImageUrl: item.coverImageUrl,
    categoryIds: item.categoryIds ?? [],
    tags: [],
    images: item.coverImageUrl
      ? [{ url: item.coverImageUrl, cover: true, order: 0, alt: item.title }]
      : [],
    rating: { average: item.ratingAverage ?? 0, count: item.ratingCount ?? 0 },
    nextSession: item.nextSessionDate
      ? { sessionId: `${item.templateId}-next`, date: item.nextSessionDate, capacity: 999, bookedCount: 0 }
      : null,
    upcomingSessionsCount: item.nextSessionDate ? 1 : 0,
    totalBookedCount: 0,
  } as PublicTemplateCard;
}

const SCROLL_AMT = 228;

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: "50%",
      border: "2px solid #ddd", borderTopColor: "#ff8c42",
      animation: "spin .85s linear infinite",
    }} />
  );
}

interface Props {
  title: string;
  items: SuggestionItem[];
  loading: boolean;
  emptyText: string;
}

export function SuggestionCarousel({ title, items, loading, emptyText }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollX = useRef(0);

  const updateNav = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    setCanPrev(t.scrollLeft > 0);
    setCanNext(t.scrollLeft + t.clientWidth < t.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    t.addEventListener("scroll", updateNav, { passive: true });
    const ro = new ResizeObserver(updateNav);
    ro.observe(t);
    updateNav();
    return () => { t.removeEventListener("scroll", updateNav); ro.disconnect(); };
  }, [updateNav, items]);

  function scrollBy(dir: 1 | -1) {
    trackRef.current?.scrollBy({ left: dir * SCROLL_AMT, behavior: "smooth" });
    setTimeout(updateNav, 320);
  }

  // Drag-to-scroll
  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (trackRef.current?.offsetLeft ?? 0);
    scrollX.current = trackRef.current?.scrollLeft ?? 0;
    if (trackRef.current) trackRef.current.style.cursor = "grabbing";
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    trackRef.current.scrollLeft = scrollX.current - (x - startX.current);
  }
  function onMouseUp() {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.cursor = "grab";
  }

  const navBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: "50%",
    border: "0.5px solid rgba(0,0,0,0.18)",
    background: "#fff", color: "#1a1a1a",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background .15s, border-color .15s", flexShrink: 0,
  };

  return (
    <section>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "0 2px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!loading && items.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 500, color: "#6b7a70",
              background: "#f5f7f4", border: "1px solid #e5ebe4",
              padding: "3px 10px", borderRadius: 99,
            }}>
              {items.length} found
            </span>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{ ...navBtnStyle, opacity: canPrev ? 1 : 0.3, cursor: canPrev ? "pointer" : "default" }}
              onClick={() => scrollBy(-1)}
              disabled={!canPrev}
              type="button"
              aria-label="Scroll left"
            >
              <ChevronLeft />
            </button>
            <button
              style={{ ...navBtnStyle, opacity: canNext ? 1 : 0.3, cursor: canNext ? "pointer" : "default" }}
              onClick={() => scrollBy(1)}
              disabled={!canNext}
              type="button"
              aria-label="Scroll right"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Track */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px", background: "#fff", border: "1.5px solid #e8e4de", borderRadius: 12, fontSize: 14, color: "#6b7a70" }}>
          <SpinnerIcon />
          <span>Loading {title.toLowerCase()}…</span>
        </div>
      ) : items.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px", background: "#fff", border: "1.5px solid #e8e4de", borderRadius: 12, fontSize: 14, color: "#6b7a70" }}>
          <span>{emptyText}</span>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <div
            ref={trackRef}
            style={{
              display: "flex", gap: 14,
              overflowX: "auto", scrollBehavior: "smooth",
              scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
              paddingBottom: 4, cursor: "grab", userSelect: "none",
              scrollSnapType: "x mandatory",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {items.map((item, i) => (
              <div key={`${item.templateId}-${i}`} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
                <CarouselCard activity={mapToCard(item)} />
              </div>
            ))}
          </div>
          {/* Fade-out right edge */}
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 48,
            background: "linear-gradient(to right, transparent, #f7f5f0)",
            pointerEvents: "none",
          }} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
