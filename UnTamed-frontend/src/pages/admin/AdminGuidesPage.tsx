import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminDataTable from "../../components/admin/AdminDataTable";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminStatusBadge, { type AdminStatus } from "../../components/admin/AdminStatusBadge";
import {
  getGuideSuspensionImpact,
  getAdminGuides,
  reactivateGuide,
  suspendGuide,
  type AdminGuide,
  type GuideSuspensionImpact,
  verifyGuide,
} from "../../api/admin.api";
import styles from "../../style/admin.module.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type GuideStatus = Extract<AdminStatus, "PENDING_VERIFICATION" | "VERIFIED" | "SUSPENDED" | "DISABLED">;
const guideStatusOptions = ["PENDING_VERIFICATION", "VERIFIED", "SUSPENDED", "DISABLED"];

function normalizeGuideStatus(status: string): GuideStatus {
  if (status === "VERIFIED" || status === "SUSPENDED" || status === "DISABLED") return status;
  return "PENDING_VERIFICATION";
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDate(value?: string | null) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function initialStatusValue(value: string | null, legacyFilter: string | null) {
  const legacyStatus = legacyFilter?.toLowerCase() === "suspended" ? "SUSPENDED" : null;
  const normalized = (value ?? legacyStatus ?? "").toUpperCase();
  return guideStatusOptions.includes(normalized) ? normalized : "ALL";
}

function initialPageValue(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function initialPageSizeValue(value: string | null) {
  const parsed = Number(value);
  return [10, 25, 50, 100].includes(parsed) ? parsed : 25;
}

function credentialLink(certificate: AdminGuide["certificates"][number]) {
  return certificate.verificationUrl || certificate.fileUrl || null;
}

export default function AdminGuidesPage() {
  const [searchParams] = useSearchParams();
  const [guides, setGuides] = useState<AdminGuide[]>([]);
  const [page, setPage] = useState(() => initialPageValue(searchParams.get("page")));
  const [pageSize, setPageSize] = useState(() => initialPageSizeValue(searchParams.get("size")));
  const [totalGuides, setTotalGuides] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyGuideId, setBusyGuideId] = useState<string | null>(null);
  const [impactLoadingGuideId, setImpactLoadingGuideId] = useState<string | null>(null);
  const [verificationGuide, setVerificationGuide] = useState<AdminGuide | null>(null);
  const [verificationReason, setVerificationReason] = useState("");
  const [suspensionGuide, setSuspensionGuide] = useState<AdminGuide | null>(null);
  const [suspensionImpact, setSuspensionImpact] = useState<GuideSuspensionImpact | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [notifyGuide, setNotifyGuide] = useState(true);
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => initialStatusValue(searchParams.get("status"), searchParams.get("filter")));
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get("query") ?? "").trim());

  async function loadGuides() {
    setLoading(true);
    return getAdminGuides({
      page,
      size: pageSize,
      query: debouncedQuery || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    })
      .then((data) => {
        setGuides(data.content);
        setTotalGuides(data.totalElements);
        setTotalPages(data.totalPages);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load admin guides");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    void loadGuides();
  }, [page, pageSize, debouncedQuery, statusFilter]);

  function updateStatusFilter(value: string) {
    setPage(0);
    setStatusFilter(value);
  }

  function updatePageSize(value: number) {
    setPage(0);
    setPageSize(value);
  }

  async function runGuideAction(guide: AdminGuide) {
    setBusyGuideId(guide.id);
    setError(null);
    setSuccess(null);

    try {
      await reactivateGuide(guide.id, { notifyGuide: true });
      setSuccess(`${guide.username || guide.email} was reactivated.`);

      await loadGuides();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Guide action failed");
    } finally {
      setBusyGuideId(null);
    }
  }

  function openVerificationModal(guide: AdminGuide) {
    setError(null);
    setSuccess(null);
    setVerificationReason("");
    setVerificationGuide(guide);
  }

  function closeVerificationModal() {
    if (busyGuideId) return;
    setVerificationGuide(null);
    setVerificationReason("");
  }

  async function confirmVerifyGuide() {
    if (!verificationGuide) return;

    setBusyGuideId(verificationGuide.id);
    setError(null);
    setSuccess(null);

    try {
      await verifyGuide(verificationGuide.id, {
        reason: verificationReason.trim() || undefined,
      });
      setSuccess(`${verificationGuide.username || verificationGuide.email} received the verified guide badge.`);
      setVerificationGuide(null);
      setVerificationReason("");
      await loadGuides();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Guide verification failed");
    } finally {
      setBusyGuideId(null);
    }
  }

  async function openSuspendModal(guide: AdminGuide) {
    setImpactLoadingGuideId(guide.id);
    setError(null);
    setSuccess(null);

    try {
      const impact = await getGuideSuspensionImpact(guide.id);
      setSuspensionGuide(guide);
      setSuspensionImpact(impact);
      setSuspensionReason("");
      setNotifyGuide(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load suspension impact");
    } finally {
      setImpactLoadingGuideId(null);
    }
  }

  function closeSuspendModal() {
    if (busyGuideId) return;
    setSuspensionGuide(null);
    setSuspensionImpact(null);
    setSuspensionReason("");
  }

  async function confirmSuspendGuide() {
    if (!suspensionGuide) return;

    setBusyGuideId(suspensionGuide.id);
    setError(null);
    setSuccess(null);

    try {
      await suspendGuide(suspensionGuide.id, {
        reason: suspensionReason.trim() || undefined,
        notifyGuide,
      });
      setSuccess(`${suspensionGuide.username || suspensionGuide.email} was suspended.`);
      closeSuspendModal();
      await loadGuides();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Guide suspension failed");
    } finally {
      setBusyGuideId(null);
    }
  }

  function renderActions(guide: AdminGuide) {
    const status = normalizeGuideStatus(guide.status);
    const busy = busyGuideId === guide.id;
    const impactLoading = impactLoadingGuideId === guide.id;

    return (
      <div className={styles.actions}>
        {status === "PENDING_VERIFICATION" && (
          <>
            <button
              className={`${styles.button} ${styles.buttonAccent}`}
              type="button"
              disabled={busy}
              onClick={() => openVerificationModal(guide)}
            >
              Review & verify
            </button>
            {!guide.suspended && (
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                type="button"
                disabled={busy || impactLoading}
                onClick={() => void openSuspendModal(guide)}
              >
                {impactLoading ? "Checking..." : "Suspend guide"}
              </button>
            )}
          </>
        )}

        {status === "VERIFIED" && (
          <button
            className={`${styles.button} ${styles.buttonDanger}`}
            type="button"
          disabled={busy}
            onClick={() => void openSuspendModal(guide)}
          >
            {impactLoading ? "Checking..." : busy ? "Working..." : "Suspend guide"}
          </button>
        )}

        {status === "SUSPENDED" && (
          <button
            className={`${styles.button} ${styles.buttonAccent}`}
            type="button"
            disabled={busy}
            onClick={() => void runGuideAction(guide)}
          >
            {busy ? "Working..." : "Reactivate guide"}
          </button>
        )}

        {status === "DISABLED" && (
          <>
            <button
              className={`${styles.button} ${styles.buttonAccent}`}
              type="button"
              disabled={busy}
              onClick={() => void runGuideAction(guide)}
            >
              {busy ? "Working..." : "Reactivate guide"}
            </button>
            {!guide.verified && (
              <button
                className={styles.button}
                type="button"
                disabled={busy}
                onClick={() => openVerificationModal(guide)}
              >
                Review & verify
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Guide Verification</h1>
          <p className={styles.pageSubtitle}>Review guide profiles, credentials, experience, and badge eligibility.</p>
        </div>
      </div>

      {error && <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p>}
      {success && <p className={`${styles.notice} ${styles.noticeSuccess}`}>{success}</p>}
      {loading && <p className={styles.pageSubtitle}>Loading guides...</p>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search guide or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={styles.filters}>
              <select className={styles.select} value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PENDING_VERIFICATION">Pending verification</option>
                <option value="VERIFIED">Verified</option>
                <option value="DISABLED">Disabled</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        <AdminDataTable columns={["Guide", "Verification", "Profile summary", "Activity health", "Joined", "Actions"]}>
          {guides.map((guide) => (
            <tr key={guide.id}>
              <td>
                <div className={styles.identity}>
                  <div className={styles.identityAvatar}>
                    {guide.profileImageUrl ? <img src={guide.profileImageUrl} alt="" /> : initials(guide.username || guide.email)}
                  </div>
                  <div>
                    <p className={styles.identityName}>{guide.username || guide.email}</p>
                    <p className={styles.mutedText}>{guide.email}</p>
                  </div>
                </div>
              </td>
              <td><AdminStatusBadge status={normalizeGuideStatus(guide.status)} /></td>
              <td>
                <p className={styles.identityName}>{guide.experienceYears ?? 0} years experience</p>
                <p className={styles.mutedText}>{guide.certificates.length} certificates on file</p>
              </td>
              <td>
                <p className={styles.identityName}>{guide.activitiesCount} activities</p>
                <p className={styles.mutedText}>{guide.rating > 0 ? `${guide.rating.toFixed(1)} rating` : "New guide"}</p>
              </td>
              <td className={styles.mutedText}>{formatDate(guide.createdAt)}</td>
              <td>
                {renderActions(guide)}
              </td>
            </tr>
          ))}

          {!loading && guides.length === 0 && (
            <tr>
              <td className={styles.mutedText} colSpan={6}>
                No guides match the selected filters.
              </td>
            </tr>
          )}
        </AdminDataTable>
        <AdminPagination
          page={page}
          size={pageSize}
          totalElements={totalGuides}
          totalPages={totalPages}
          loading={loading}
          onPageChange={setPage}
          onSizeChange={updatePageSize}
        />
      </section>

      {verificationGuide && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeVerificationModal}>
          <div className={`${styles.modal} ${styles.wideModal}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Guide verification review</p>
                <h2 className={styles.modalTitle}>Verify guide badge</h2>
                <p className={styles.pageSubtitle}>
                  Review the available profile evidence before granting the verified badge.
                </p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeVerificationModal} disabled={Boolean(busyGuideId)}>
                X
              </button>
            </div>

            <div className={styles.reviewHero}>
              <div className={styles.identityAvatar}>
                {verificationGuide.profileImageUrl ? (
                  <img src={verificationGuide.profileImageUrl} alt="" />
                ) : (
                  initials(verificationGuide.username || verificationGuide.email)
                )}
              </div>
              <div>
                <h3>{verificationGuide.username || verificationGuide.email}</h3>
                <p>{verificationGuide.email}</p>
              </div>
              <AdminStatusBadge status={normalizeGuideStatus(verificationGuide.status)} />
            </div>

            <div className={styles.resultGrid}>
              <div className={styles.resultItem}>
                <span>Joined</span>
                <strong>{formatDate(verificationGuide.createdAt)}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Activities</span>
                <strong>{verificationGuide.activitiesCount}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Experience</span>
                <strong>{verificationGuide.experienceYears ?? 0}y</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Rating</span>
                <strong>
                  {verificationGuide.rating > 0
                    ? `${verificationGuide.rating.toFixed(1)} (${verificationGuide.ratingCount ?? 0})`
                    : "New"}
                </strong>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <h3>Profile summary</h3>
              <p>{verificationGuide.bio?.trim() || "No guide bio has been provided yet."}</p>
            </div>

            <div className={styles.reviewSection}>
              <div className={styles.panelHeaderRow}>
                <h3>Certificates and credentials</h3>
                <span className={styles.mutedText}>{verificationGuide.certificates.length} on file</span>
              </div>
              {verificationGuide.certificates.length > 0 ? (
                <div className={styles.certificateList}>
                  {verificationGuide.certificates.map((certificate, index) => {
                    const link = credentialLink(certificate);
                    return (
                      <article className={styles.certificateItem} key={certificate.id || `${certificate.title}-${index}`}>
                        <div>
                          <h4>{certificate.title || "Untitled credential"}</h4>
                          <p>
                            {certificate.issuer || "Issuer not provided"} · Issued {formatFullDate(certificate.issuedAt)}
                          </p>
                          {certificate.credentialId && <p>Credential ID: {certificate.credentialId}</p>}
                        </div>
                        {link ? (
                          <a className={styles.sectionLink} href={link} target="_blank" rel="noreferrer">
                            Open proof
                          </a>
                        ) : (
                          <span className={styles.mutedText}>No proof link</span>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.modalHint}>No certificates are attached to this guide profile.</p>
              )}
            </div>

            <p className={styles.modalHint}>
              Verifying this guide grants the public verified guide badge. It does not change account email verification, suspension state, sessions, bookings, or refunds.
            </p>

            <div className={styles.reviewSection}>
              <label className={styles.fieldLabel} htmlFor="guide-verification-reason">
                Audit note
              </label>
              <textarea
                id="guide-verification-reason"
                className={styles.textarea}
                value={verificationReason}
                maxLength={1000}
                onChange={(event) => setVerificationReason(event.target.value)}
                placeholder="Optional note, for example: Certificates and public guide profile reviewed."
                disabled={Boolean(busyGuideId)}
              />
              <p className={styles.modalHint}>
                This note is saved to the admin audit log with the guide verification event.
              </p>
            </div>

            <div className={styles.modalActions}>
              <Link className={styles.sectionLink} to={`/users/${verificationGuide.id}`} target="_blank" rel="noreferrer">
                View public profile
              </Link>
              <button className={styles.button} type="button" onClick={closeVerificationModal} disabled={Boolean(busyGuideId)}>
                Cancel
              </button>
              <button
                className={`${styles.button} ${styles.buttonAccent}`}
                type="button"
                disabled={Boolean(busyGuideId)}
                onClick={() => void confirmVerifyGuide()}
              >
                {busyGuideId === verificationGuide.id ? "Verifying..." : "Grant verified badge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {suspensionGuide && suspensionImpact && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeSuspendModal}>
          <div className={`${styles.modal} ${styles.wideModal}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.resultLabel}>Suspension impact</p>
                <h2 className={styles.modalTitle}>Suspend guide</h2>
                <p className={styles.pageSubtitle}>
                  {suspensionImpact.guideName || suspensionGuide.username || suspensionImpact.guideEmail} · {suspensionImpact.guideEmail}
                </p>
              </div>
              <button className={styles.iconButton} type="button" onClick={closeSuspendModal} disabled={Boolean(busyGuideId)}>
                X
              </button>
            </div>

            <div className={styles.resultGrid}>
              <div className={styles.resultItem}>
                <span>Upcoming sessions</span>
                <strong>{suspensionImpact.upcomingSessionsCount}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Confirmed bookings</span>
                <strong>{suspensionImpact.confirmedBookingsCount}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Pending bookings</span>
                <strong>{suspensionImpact.pendingBookingsCount}</strong>
              </div>
              <div className={styles.resultItem}>
                <span>Paying bookings</span>
                <strong>{suspensionImpact.payingBookingsCount}</strong>
              </div>
            </div>

            <p className={styles.modalHint}>
              Estimated paid amount affected: <strong>{formatMoney(suspensionImpact.estimatedPaidAmount)}</strong>. Suspension blocks new bookings and payment continuation, but does not cancel sessions or refund bookings automatically.
            </p>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Bookings</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {suspensionImpact.sessions.slice(0, 5).map((session) => (
                    <tr key={session.sessionId}>
                      <td>
                        <p className={styles.identityName}>{session.activityTitle}</p>
                        <p className={styles.mutedText}>{formatDateTime(session.startDateTime)}</p>
                      </td>
                      <td>{session.status}</td>
                      <td className={styles.mutedText}>
                        {session.confirmedBookingsCount} confirmed · {session.pendingBookingsCount} pending · {session.payingBookingsCount} paying
                      </td>
                      <td>{formatMoney(session.paidAmount)}</td>
                    </tr>
                  ))}
                  {suspensionImpact.sessions.length === 0 && (
                    <tr>
                      <td className={styles.mutedText} colSpan={4}>No upcoming non-cancelled sessions are affected.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {suspensionImpact.sessions.length > 5 && (
              <p className={styles.modalHint}>Showing first 5 affected sessions.</p>
            )}

            <label className={styles.fieldLabel} htmlFor="suspension-reason">Reason</label>
            <textarea
              id="suspension-reason"
              className={styles.textarea}
              value={suspensionReason}
              onChange={(event) => setSuspensionReason(event.target.value)}
              placeholder="Policy issue / safety concern / document review / admin decision"
              rows={4}
            />

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={notifyGuide}
                onChange={(event) => setNotifyGuide(event.target.checked)}
              />
              <span>Notify guide</span>
            </label>

            <div className={styles.modalActions}>
              <Link
                className={styles.sectionLink}
                to={`/admin/sessions?guideId=${suspensionGuide.id}&needsReview=true`}
              >
                Review affected sessions
              </Link>
              <button className={styles.button} type="button" onClick={closeSuspendModal} disabled={Boolean(busyGuideId)}>
                Cancel
              </button>
              <button
                className={`${styles.button} ${styles.buttonDanger}`}
                type="button"
                disabled={Boolean(busyGuideId)}
                onClick={() => void confirmSuspendGuide()}
              >
                {busyGuideId ? "Suspending..." : "Confirm suspension"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
