import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ActivityTemplateResponse, ActivitySessionResponse } from "../types/activity";
import { listMyTemplates, listMySessions } from "../api/activity.api";
import styles from "../style/guideActivities.module.css";

function coverUrl(t: ActivityTemplateResponse) {
  return (t.images ?? []).find((i) => i.cover)?.url ?? null;
}

function difficultyConfig(d: string): { label: string; color: string; bg: string } {
  if (d === "HARD")   return { label: "Hard",   color: "#dc2626", bg: "rgba(220,38,38,0.12)" };
  if (d === "MEDIUM") return { label: "Medium", color: "#d97706", bg: "rgba(217,119,6,0.12)" };
  return                     { label: "Easy",   color: "#16a34a", bg: "rgba(22,163,74,0.12)" };
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GuideActivitiesPage() {
  const nav = useNavigate();
  const [templates, setTemplates] = useState<ActivityTemplateResponse[]>([]);
  const [sessions, setSessions] = useState<ActivitySessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [tmpl, sess] = await Promise.all([listMyTemplates(), listMySessions()]);
      setTemplates(tmpl ?? []);
      setSessions(sess ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const sessionMap = useMemo(() => {
    const map = new Map<string, { total: number; published: number; upcoming: number; nextDate: string | null }>();
    const now = Date.now();
    for (const s of sessions) {
      const prev = map.get(s.templateId) ?? { total: 0, published: 0, upcoming: 0, nextDate: null };
      const isUpcoming  = new Date(s.date).getTime() >= now;
      const isPublished = s.status === "PUBLISHED";
      map.set(s.templateId, {
        total:     prev.total + 1,
        published: prev.published + (isPublished ? 1 : 0),
        upcoming:  prev.upcoming  + (isUpcoming  ? 1 : 0),
        nextDate:  isUpcoming && isPublished
          ? (!prev.nextDate || new Date(s.date) < new Date(prev.nextDate) ? s.date : prev.nextDate)
          : prev.nextDate,
      });
    }
    return map;
  }, [sessions]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return templates
      .filter((t) => !text || `${t.title ?? ""} ${t.description ?? ""}`.toLowerCase().includes(text))
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));
  }, [templates, q]);

  const totalPublished = sessions.filter((s) => s.status === "PUBLISHED").length;
  const totalUpcoming  = sessions.filter((s) => new Date(s.date).getTime() >= Date.now()).length;

  return (
    <div className={styles.shell}>

      {/* ── TOP BAR ── */}
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.pageTitle}>My Activities</h1>
          <p className={styles.pageSub}>
            {templates.length} template{templates.length !== 1 ? "s" : ""} · {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className={styles.topBarActions}>
          <button className={styles.btnRefresh} type="button" onClick={refresh} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Refresh
          </button>
          <button className={styles.btnCreate} type="button" onClick={() => nav("/activities/create")}>
            + New Activity
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className={styles.statsRow}>
        {[
          { value: templates.length,  label: "Templates",  accent: false },
          { value: sessions.length,   label: "Sessions",   accent: false },
          { value: totalPublished,    label: "Published",  accent: true  },
          { value: totalUpcoming,     label: "Upcoming",   accent: false },
        ].map(({ value, label, accent }) => (
          <div key={label} className={styles.statCard}>
            <span className={`${styles.statValue} ${accent ? styles.statValueAccent : ""}`}>
              {value}
            </span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── SEARCH ── */}
      <div className={styles.searchBar}>
        <div className={styles.searchField}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className={styles.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or description…"
          />
          {q && <button className={styles.clearBtn} type="button" onClick={() => setQ("")}>✕</button>}
        </div>
        {q && <span className={styles.resultHint}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* ── ERROR ── */}
      {err && <div className={styles.errBanner}>⚠️ {err}</div>}

      {/* ── LOADING ── */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          Loading your activities…
        </div>
      )}

      {/* ── EMPTY ── */}
      {!loading && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p className={styles.emptyTitle}>
            {q ? "No matches found" : "No activities yet"}
          </p>
          <p className={styles.emptySub}>
            {q ? `Nothing matches "${q}"` : "Create your first activity to start accepting bookings"}
          </p>
          {!q && (
            <button className={styles.btnCreate} type="button" onClick={() => nav("/activities/create")}>
              + New Activity
            </button>
          )}
        </div>
      )}

      {/* ── GRID ── */}
      {!loading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((t, i) => {
            const cover = coverUrl(t);
            const sess  = sessionMap.get(t.id);
            const diff  = difficultyConfig(t.difficulty);
            const isFree = Number(t.price ?? 0) === 0;

            return (
              <article key={t.id} className={styles.card} style={{ animationDelay: `${i * 0.04}s` }}>

                {/* IMAGE ZONE */}
                <div
                  className={styles.cardImage}
                  style={cover
                    ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined}
                >
                  {!cover && (
                    <div className={styles.imgFallback}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4c9d1" strokeWidth="1.3">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div className={styles.imgScrim} />

                  {/* top-left: difficulty */}
                  <span className={styles.diffTag} style={{ color: diff.color, background: diff.bg }}>
                    {diff.label}
                  </span>

                  {/* bottom-left: price */}
                  <span className={styles.priceTag}>
                    {isFree ? "Free" : `${t.price} TND`}
                  </span>
                </div>

                {/* CONTENT */}
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{t.title}</h3>

                  {/* session info row */}
                  <div className={styles.sessionInfo}>
                    {sess ? (
                      <>
                        <span className={styles.chip}>
                          📅 {sess.total} session{sess.total !== 1 ? "s" : ""}
                        </span>
                        {sess.published > 0
                          ? <span className={`${styles.chip} ${styles.chipGreen}`}>✓ {sess.published} live</span>
                          : <span className={`${styles.chip} ${styles.chipGray}`}>Not published</span>
                        }
                        {sess.nextDate && (
                          <span className={`${styles.chip} ${styles.chipOrange}`}>
                            Next {formatDateShort(sess.nextDate)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={`${styles.chip} ${styles.chipWarn}`}>Add a session to publish</span>
                    )}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.actionEdit}
                    onClick={() => nav(`/guide/templates/${t.id}/edit`)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={styles.actionSessions}
                    onClick={() => nav(`/guide/templates/${t.id}/sessions`)}
                  >
                    Sessions
                    {sess && sess.total > 0 && (
                      <span className={styles.sessCount}>{sess.total}</span>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}