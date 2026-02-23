import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ActivityResponse, ActivityStatus } from "../types/activity";
import { listMyActivities, setActivityStatus } from "../api/activity.api";
import { ActivityCard } from "../components/ActivityCard";
import styles from "../style/guideActivities.module.css";

type Tab = "ALL" | "DRAFT" | "PUBLISHED" | "CANCELLED";

function statusBadge(status: ActivityStatus) {
  const s = status ?? "DRAFT";
  const cls =
    s === "PUBLISHED" ? `${styles.st} ${styles.stPub}` : s === "CANCELLED" ? `${styles.st} ${styles.stCan}` : `${styles.st} ${styles.stDra}`;
  return <span className={cls}>{s}</span>;
}

function niceError(msg: string) {
  // Turn common backend errors into nicer messages
  if (msg.includes("location")) return "Add a location before publishing.";
  if (msg.includes("coordinates")) return "Pick a location with map coordinates before publishing.";
  if (msg.includes("image")) return "Upload at least one photo before publishing.";
  if (msg.includes("category")) return "Select at least one category before publishing.";
  if (msg.includes("future")) return "Choose a future date before publishing.";
  if (msg.includes("Not allowed")) return "You can only manage your own activities.";
  return msg;
}

export default function GuideActivitiesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await listMyActivities();
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load activities");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return items
      .filter((a) => {
        if (tab === "ALL") return true;
        return (a.status ?? "DRAFT") === tab;
      })
      .filter((a) => {
        if (!text) return true;
        const hay = `${a.title ?? ""} ${a.description ?? ""}`.toLowerCase();
        return hay.includes(text);
      })
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [items, tab, q]);

  async function togglePublish(a: ActivityResponse) {
    const current = a.status ?? "DRAFT";
    const next: ActivityStatus = current === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    setBusyId(a.id);
    setErr(null);
    try {
      const updated = await setActivityStatus(a.id, next);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      setErr(niceError(msg));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.ga}>
      <div className={styles.gaTop}>
        <div>
          <h1 className={styles.gaTitle}>My Activities</h1>
          <p className={styles.gaSub}>Create, edit, and publish your adventures.</p>
        </div>

        <div className={styles.gaActions}>
          <button className={styles.gaBtn} type="button" onClick={() => nav("/activities/create")}>
            ➕ Create
          </button>
          <button className={`${styles.gaBtn} ${styles.gaBtnGhost}`} type="button" onClick={refresh}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className={styles.gaBar}>
        <div className={styles.gaTabs}>
          {(["ALL", "DRAFT", "PUBLISHED", "CANCELLED"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.gaTab} ${tab === t ? styles.gaTabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          className={styles.gaSearch}   
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or description..."
        />
      </div>

      {err && <div className={`${styles.gaAlert} ${styles.gaAlertError}`}>⚠️ {err}</div>}

      {loading ? (
        <div className={styles.gaLoading}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.gaEmpty}   >
          <div className={styles.gaEmptyIcon}>🏕️</div>
          <div className={styles.gaEmptyTitle}>No activities found</div>
          <div className={styles.gaEmptySub}>Try another tab or create your first activity.</div>
          <button className={styles.gaBtn} type="button" onClick={() => nav("/activities/create")}>
            Create activity
          </button>
        </div>
      ) : (
        <div className={styles.gaGrid}>
          {filtered.map((a, idx) => (
            <div key={a.id} className={styles.gaCardWrap}>
              <div className={styles.gaCardTop}>
                {statusBadge(a.status)}
                <div className={styles.gaCardBtns}>
                  <button
                    type="button"
                    className={styles.gaMini}
                    onClick={() => nav(`/guide/activities/${a.id}/edit`)}
                  >
                    ✏️ Edit
                  </button>

                  <button
                    type="button"
                    className={`${styles.gaMini} ${styles.gaMiniPrimary}`}
                    onClick={() => togglePublish(a)}
                    disabled={busyId === a.id || a.status === "CANCELLED"}
                    title={a.status === "CANCELLED" ? "Cancelled activities are read-only" : ""}
                  >
                    {busyId === a.id
                      ? "…"
                      : (a.status ?? "DRAFT") === "PUBLISHED"
                      ? "Unpublish"
                      : "Publish"}
                  </button>
                </div>
              </div>

              <ActivityCard activity={a} index={idx} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}