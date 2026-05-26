import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import { listCategories } from "../../api/category.api";
import {
  disableAdminActivity,
  getAdminActivities,
  republishAdminActivity,
  type AdminActivity,
} from "../../api/admin.api";
import type { Category } from "../../types/category";
import styles from "../../style/admin.module.css";

function normalizeStatus(status: string): Extract<AdminStatus, "PUBLISHED" | "DISABLED" | "DRAFT"> {
  if (status === "PUBLISHED" || status === "DISABLED") return status;
  return "DRAFT";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value));
}

function shortLocation(value: string) {
  if (!value) return "Unknown location";
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
}

function initialStatusValue(value: string | null) {
  const normalized = (value ?? "").toUpperCase();
  return normalized === "PUBLISHED" || normalized === "DISABLED" ? normalized : "ALL";
}

function initialPageValue(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function initialPageSizeValue(value: string | null) {
  const parsed = Number(value);
  return [10, 25, 50, 100].includes(parsed) ? parsed : 25;
}

export default function AdminActivitiesPage() {
  const [searchParams] = useSearchParams();
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalActivities, setTotalActivities] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("query") ?? "").trim());
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category") ?? "ALL");
  const [statusFilter, setStatusFilter] = useState(() => initialStatusValue(searchParams.get("status")));
  const [selectedActivity, setSelectedActivity] = useState<AdminActivity | null>(null);
  const [action, setAction] = useState<"disable" | "republish" | null>(null);
  const [reason, setReason] = useState("");
  const [busyActivityId, setBusyActivityId] = useState<string | null>(null);

  async function loadActivities() {
    setLoading(true);
    try {
      const data = await getAdminActivities({
        page,
        size: pageSize,
        query: debouncedQuery || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
      });
      setActivities(data.content);
      setTotalActivities(data.totalElements);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load admin activities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void listCategories({ activeOnly: false })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    void loadActivities();
  }, [page, pageSize, debouncedQuery, categoryFilter, statusFilter]);

  function updateCategoryFilter(value: string) {
    setPage(0);
    setCategoryFilter(value);
  }

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  function clearFilters() {
    setPage(0);
    setQuery("");
    setDebouncedQuery("");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
  }

  function openModal(activity: AdminActivity, nextAction: "disable" | "republish") {
    setSelectedActivity(activity);
    setAction(nextAction);
    setReason("");
    setError(null);
    setSuccess(null);
  }

  function closeModal() {
    if (busyActivityId) return;
    setSelectedActivity(null);
    setAction(null);
    setReason("");
  }

  async function confirmAction() {
    if (!selectedActivity || !action) return;
    if (action === "disable" && reason.trim().length < 4) return;

    setBusyActivityId(selectedActivity.id);
    setError(null);
    setSuccess(null);

    try {
      if (action === "disable") {
        await disableAdminActivity(selectedActivity.id, reason.trim());
        setSuccess(`${selectedActivity.title} was disabled.`);
      } else {
        await republishAdminActivity(selectedActivity.id, reason.trim());
        setSuccess(`${selectedActivity.title} was republished.`);
      }
      closeModal();
      await loadActivities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Activity action failed");
    } finally {
      setBusyActivityId(null);
    }
  }

  function renderActions(activity: AdminActivity) {
    const status = normalizeStatus(activity.status);
    if (status === "PUBLISHED") {
      return (
        <button
          className={`${styles.button} ${styles.buttonDanger}`}
          type="button"
          disabled={busyActivityId === activity.id}
          onClick={() => openModal(activity, "disable")}
        >
          Disable
        </button>
      );
    }

    if (status === "DISABLED") {
      return (
        <button
          className={`${styles.button} ${styles.buttonAccent}`}
          type="button"
          disabled={busyActivityId === activity.id}
          onClick={() => openModal(activity, "republish")}
        >
          Republish
        </button>
      );
    }

    return <span className={styles.mutedText}>No action</span>;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Activity Moderation</h1>
          <p className={styles.pageSubtitle}>Review adventure listings, publishing state, guide ownership, and session health.</p>
        </div>
        <button className={styles.button} type="button" onClick={() => void loadActivities()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <span>{error}</span>
          <div className={styles.noticeActions}>
            <button className={styles.button} type="button" onClick={() => void loadActivities()} disabled={loading}>
              Retry
            </button>
          </div>
        </div>
      )}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading activities...</p>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search title, location, category, or guide"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select
                className={styles.select}
                value={categoryFilter}
                onChange={(event) => updateCategoryFilter(event.target.value)}
              >
                <option value="ALL">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
            <button className={styles.button} type="button" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
          </div>
        </div>

        <AdminDataTable columns={["Activity", "Guide", "Category", "Status", "Sessions", "Created", "Actions"]}>
          {activities.map((activity) => (
            <tr key={activity.id}>
              <td>
                <div className={styles.mediaIdentity}>
                  <div className={styles.activityThumb}>
                    {activity.coverImageUrl ? <img src={activity.coverImageUrl} alt="" /> : <span>AC</span>}
                  </div>
                  <div>
                    <p className={styles.identityName}>{activity.title}</p>
                    <p className={styles.mutedText}>{shortLocation(activity.location)}</p>
                  </div>
                </div>
              </td>
              <td>
                <p className={styles.identityName}>{activity.guideName}</p>
                <p className={styles.mutedText}>{activity.guideEmail}</p>
              </td>
              <td className={styles.mutedText}>{activity.category}</td>
              <td><AdminStatusBadge status={normalizeStatus(activity.status)} /></td>
              <td>
                {activity.publishedSessionsCount} / {activity.sessionsCount}
                <p className={styles.mutedText}>published / total</p>
              </td>
              <td className={styles.mutedText}>{formatDate(activity.createdAt)}</td>
              <td><div className={styles.actions}>{renderActions(activity)}</div></td>
            </tr>
          ))}

          {!loading && activities.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={7}>
                No activities match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>

        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalActivities}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {selectedActivity && action && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Activity moderation</p>
                <h2 className={styles.modalTitle}>{action === "disable" ? "Disable activity" : "Republish activity"}</h2>
                <p className={styles.pageSubtitle}>{selectedActivity.title}</p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeModal} disabled={Boolean(busyActivityId)}>
                X
              </button>
            </div>

            {action === "disable" && (
              <>
                <label className={styles.fieldLabel} htmlFor="activity-reason">Reason</label>
                <textarea
                  id="activity-reason"
                  className={styles.textarea}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Safety issue / policy violation / guide issue / admin decision"
                  rows={4}
                />
              </>
            )}

            <p className={styles.modalHint}>
              {action === "disable"
                ? "The activity will stop appearing as bookable. Sessions, bookings, payments, and refunds are not automatically changed."
                : "The activity will become public/bookable again only if its guide is active and verified. Cancelled sessions stay cancelled."}
            </p>

            <div className={styles.modalActions}>
              <button className={styles.button} type="button" onClick={closeModal} disabled={Boolean(busyActivityId)}>
                Cancel
              </button>
              <button
                className={`${styles.button} ${action === "disable" ? styles.buttonDanger : styles.buttonAccent}`}
                type="button"
                disabled={Boolean(busyActivityId) || (action === "disable" && reason.trim().length < 4)}
                onClick={() => void confirmAction()}
              >
                {busyActivityId ? "Working..." : action === "disable" ? "Confirm disable" : "Confirm republish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
