import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/auth.store";
import * as GuideApi from "../api/guide.api";
import type { Certificate, GuideProfileResponse } from "../api/guide.api";
import styles from "../style/Guideprofileeditpage.module.css";
import { Header } from "../components/Header";
import { BackButton } from "../components/BackButton";

type CertDraft = Omit<Certificate, "id">;
type CertificateStatus = "valid" | "expiring" | "expired";

const emptyDraft = (): CertDraft => ({
  title: "",
  issuer: "",
  credentialId: null,
  issuedAt: null,
  expiresAt: null,
  verificationUrl: null,
  fileUrl: null,
  fileType: null,
  fileSizeBytes: null,
});

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toPayloadInstant(value?: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function certificateStatus(expiresAt?: string | null): { label: string; status: CertificateStatus } {
  if (!expiresAt) return { label: "Valid", status: "valid" };

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return { label: "Valid", status: "valid" };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expires.setHours(0, 0, 0, 0);

  if (expires < now) return { label: "Expired", status: "expired" };

  const daysUntilExpiry = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000);
  if (daysUntilExpiry <= 90) return { label: "Expiring soon", status: "expiring" };

  return { label: "Valid", status: "valid" };
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCertificateDraft(payload: CertDraft) {
  if (!payload.title) return "Certificate title is required.";
  if (!payload.issuer) return "Issuing organization is required.";
  if (payload.title.length > 120) return "Certificate title must be 120 characters or fewer.";
  if (payload.issuer.length > 120) return "Issuing organization must be 120 characters or fewer.";
  if (payload.credentialId && payload.credentialId.length > 120) return "Credential ID must be 120 characters or fewer.";
  if (payload.verificationUrl && !isValidHttpUrl(payload.verificationUrl)) {
    return "Verification URL must start with http:// or https://.";
  }
  if (payload.issuedAt && payload.expiresAt && new Date(payload.expiresAt) < new Date(payload.issuedAt)) {
    return "Expiration date cannot be before the issue date.";
  }
  return null;
}

export function GuideProfileEditPage() {
  const { user } = useAuth();

  const [experienceYears, setExperienceYears] = useState<string>("");

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [draft, setDraft] = useState<CertDraft>(emptyDraft());
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CertDraft>(emptyDraft());

  const [saving, setSaving] = useState(false);
  const [certBusy, setCertBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isGuide = user?.role === "GUIDE";

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!isGuide) return;
      try {
        const gp: GuideProfileResponse = await GuideApi.getGuideMe();
        if (!alive) return;
        setExperienceYears(gp.experienceYears != null ? String(gp.experienceYears) : "");
        setCertificates(gp.certificates ?? []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load guide profile");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [isGuide]);

  const parsedExperience = useMemo(() => {
    const trimmed = experienceYears.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : NaN;
  }, [experienceYears]);

  const onSaveExperience = async () => {
    if (!isGuide) return;

    if (parsedExperience !== null && (Number.isNaN(parsedExperience) || parsedExperience < 0 || parsedExperience > 80)) {
      setErr("Experience years must be a number between 0 and 80");
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const updated = await GuideApi.updateGuideMe({ experienceYears: parsedExperience });
      setExperienceYears(updated.experienceYears != null ? String(updated.experienceYears) : "");
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Certificates helpers ----------
  const setDraftField = (k: keyof CertDraft, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const setEditField = (k: keyof CertDraft, v: any) => setEditingDraft((d) => ({ ...d, [k]: v }));

  function normalizeCertPayload(p: CertDraft): CertDraft {
    const norm = (s: any) => {
      if (s == null) return null;
      const t = String(s).trim();
      return t === "" ? null : t;
    };

    return {
      title: String(p.title ?? "").trim(),
      issuer: String(p.issuer ?? "").trim(),
      credentialId: norm(p.credentialId),
      issuedAt: toPayloadInstant(norm(p.issuedAt)),
      expiresAt: toPayloadInstant(norm(p.expiresAt)),
      verificationUrl: norm(p.verificationUrl),
      fileUrl: norm(p.fileUrl),
      fileType: norm(p.fileType),
      fileSizeBytes: p.fileSizeBytes ?? null,
    };
  }

  const onAddCertificate = async () => {
    if (!isGuide) return;

    const payload = normalizeCertPayload(draft);
    const validationError = validateCertificateDraft(payload);
    if (validationError) {
      setErr(validationError);
      return;
    }

    setCertBusy(true);
    setErr(null);
    try {
      const updated = await GuideApi.addCertificate(payload);
      setCertificates(updated.certificates ?? []);
      setDraft(emptyDraft());
      setShowAddForm(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add certificate");
    } finally {
      setCertBusy(false);
    }
  };

  const startEdit = (c: Certificate) => {
    setErr(null);
    setEditingId(c.id);
    setEditingDraft({
      title: c.title ?? "",
      issuer: c.issuer ?? "",
      credentialId: c.credentialId ?? null,
      issuedAt: toInputDate(c.issuedAt),
      expiresAt: toInputDate(c.expiresAt),
      verificationUrl: c.verificationUrl ?? null,
      fileUrl: c.fileUrl ?? null,
      fileType: c.fileType ?? null,
      fileSizeBytes: c.fileSizeBytes ?? null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft(emptyDraft());
  };

  const onUpdateCertificate = async () => {
    if (!isGuide || !editingId) return;

    const payload = normalizeCertPayload(editingDraft);
    const validationError = validateCertificateDraft(payload);
    if (validationError) {
      setErr(validationError);
      return;
    }

    setCertBusy(true);
    setErr(null);
    try {
      const updated = await GuideApi.updateCertificate(editingId, payload);
      setCertificates(updated.certificates ?? []);
      cancelEdit();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update certificate");
    } finally {
      setCertBusy(false);
    }
  };

  const onDeleteCertificate = async (id: string) => {
    if (!isGuide) return;
    if (!confirm("Are you sure you want to delete this certificate?")) return;

    setCertBusy(true);
    setErr(null);
    try {
      const updated = await GuideApi.deleteCertificate(id);
      setCertificates(updated.certificates ?? []);
      if (editingId === id) cancelEdit();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete certificate");
    } finally {
      setCertBusy(false);
    }
  };

  if (!user) return <div className={styles.loading}>Not authenticated</div>;
  if (user.role !== "GUIDE") return <div className={styles.loading}>Only guides can edit guide profile</div>;

  return (
    <><Header></Header>
    <div className={styles.container}>
      <div className={styles.header}>
        <BackButton fallbackTo="/profile" />
        <h1 className={styles.title}>Edit guide profile</h1>
      </div>

      {err && (
        <div className={styles.errorBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {err}
          <button onClick={() => setErr(null)} className={styles.dismissError}>×</button>
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <svg className={styles.sidebarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className={styles.sidebarTitle}>Guide profile</h3>
            <p className={styles.sidebarText}>
              Your guide profile helps travelers learn about your experience and expertise. This information will be visible to all users.
            </p>
          </div>

          <div className={styles.sidebarStats}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{experienceYears || "0"}</div>
              <div className={styles.statLabel}>Years experience</div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{certificates.length}</div>
              <div className={styles.statLabel}>Certificates</div>
            </div>
          </div>
        </aside>

        <main className={styles.main}>
          {/* Experience Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>Experience</h2>
                <p className={styles.sectionSubtitle}>How many years have you been guiding?</p>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.experienceInput}>
                <input
                  id="experience"
                  type="number"
                  min="0"
                  max="80"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="5"
                  className={styles.numberInput}
                />
                <span className={styles.experienceLabel}>years of experience</span>
              </div>
              <button onClick={onSaveExperience} disabled={saving} className={styles.saveBtn}>
                {saving ? (
                  <>
                    <svg className={styles.spinner} viewBox="0 0 24 24">
                      <circle className={styles.spinnerCircle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </section>

          {/* Certificates Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className={styles.sectionHeaderContent}>
                <div>
                  <h2 className={styles.sectionTitle}>Certifications</h2>
                  <p className={styles.sectionSubtitle}>Add your professional certifications to build trust</p>
                </div>
                {!showAddForm && (
                  <button 
                    onClick={() => setShowAddForm(true)} 
                    className={styles.addButton}
                    disabled={certBusy}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add certificate
                  </button>
                )}
              </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div className={styles.card}>
                <div className={styles.formHeader}>
                  <h3 className={styles.formTitle}>New certificate</h3>
                  <button 
                    onClick={() => {
                      setShowAddForm(false);
                      setDraft(emptyDraft());
                    }} 
                    className={styles.closeButton}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>
                      Certificate title <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.formInput}
                      maxLength={120}
                      value={draft.title}
                      onChange={(e) => setDraftField("title", e.target.value)}
                      placeholder="e.g., Wilderness First Responder"
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>
                      Issuing organization <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.formInput}
                      maxLength={120}
                      value={draft.issuer}
                      onChange={(e) => setDraftField("issuer", e.target.value)}
                      placeholder="e.g., NOLS Wilderness Medicine"
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Credential ID</label>
                    <input
                      className={styles.formInput}
                      maxLength={120}
                      value={draft.credentialId ?? ""}
                      onChange={(e) => setDraftField("credentialId", e.target.value)}
                      placeholder="ABC-123-XYZ"
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Issued date</label>
                    <input
                      className={styles.formInput}
                      type="date"
                      value={draft.issuedAt ?? ""}
                      onChange={(e) => setDraftField("issuedAt", e.target.value)}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Expiration date</label>
                    <input
                      className={styles.formInput}
                      type="date"
                      value={draft.expiresAt ?? ""}
                      onChange={(e) => setDraftField("expiresAt", e.target.value)}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Verification URL</label>
                    <input
                      className={styles.formInput}
                      type="url"
                      value={draft.verificationUrl ?? ""}
                      onChange={(e) => setDraftField("verificationUrl", e.target.value)}
                      placeholder="https://verify.example.com/..."
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button onClick={onAddCertificate} disabled={certBusy} className={styles.saveBtn}>
                    {certBusy ? "Adding..." : "Add certificate"}
                  </button>
                  <button 
                    onClick={() => {
                      setShowAddForm(false);
                      setDraft(emptyDraft());
                    }} 
                    disabled={certBusy} 
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Certificate List */}
            {certificates.length === 0 ? (
              <div className={styles.emptyState}>
                <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <h3 className={styles.emptyTitle}>No certificates yet</h3>
                <p className={styles.emptyText}>
                  Add certificates to build trust with adventurers.
                </p>
                {!showAddForm && (
                  <button onClick={() => setShowAddForm(true)} className={styles.emptyButton}>
                    Add your first certificate
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.certList}>
                {certificates.map((c) => {
                  const isEditing = editingId === c.id;
                  const status = certificateStatus(c.expiresAt);
                  return (
                    <div key={c.id} className={styles.certCard}>
                      {!isEditing ? (
                        <>
                          <div className={styles.certBadge}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>

                          <div className={styles.certContent}>
                            <div className={styles.certTopline}>
                              <h4 className={styles.certTitle}>{c.title}</h4>
                              <span className={`${styles.statusPill} ${styles[`status${status.status}`]}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className={styles.certIssuer}>{c.issuer}</p>
                            {c.credentialId && (
                              <p className={styles.certCredential}>ID: {c.credentialId}</p>
                            )}
                            {(c.issuedAt || c.expiresAt) && (
                              <p className={styles.certDates}>
                                {[c.issuedAt ? `Issued ${formatDate(c.issuedAt)}` : null, c.expiresAt ? `Expires ${formatDate(c.expiresAt)}` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {c.verificationUrl && (
                              <a 
                                href={c.verificationUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={styles.certLink}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Verify credential
                              </a>
                            )}
                          </div>

                          <div className={styles.certActions}>
                            <button 
                              className={styles.iconButton} 
                              onClick={() => startEdit(c)} 
                              disabled={certBusy}
                              title="Edit"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className={styles.iconButtonDanger}
                              onClick={() => onDeleteCertificate(c.id)}
                              disabled={certBusy}
                              title="Delete"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className={styles.certEditForm}>
                          <div className={styles.formGrid}>
                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Certificate title</label>
                              <input
                                className={styles.formInput}
                                maxLength={120}
                                value={editingDraft.title}
                                onChange={(e) => setEditField("title", e.target.value)}
                              />
                            </div>

                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Issuing organization</label>
                              <input
                                className={styles.formInput}
                                maxLength={120}
                                value={editingDraft.issuer}
                                onChange={(e) => setEditField("issuer", e.target.value)}
                              />
                            </div>

                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Credential ID</label>
                              <input
                                className={styles.formInput}
                                maxLength={120}
                                value={editingDraft.credentialId ?? ""}
                                onChange={(e) => setEditField("credentialId", e.target.value)}
                              />
                            </div>

                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Issued date</label>
                              <input
                                className={styles.formInput}
                                type="date"
                                value={editingDraft.issuedAt ?? ""}
                                onChange={(e) => setEditField("issuedAt", e.target.value)}
                              />
                            </div>

                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Expiration date</label>
                              <input
                                className={styles.formInput}
                                type="date"
                                value={editingDraft.expiresAt ?? ""}
                                onChange={(e) => setEditField("expiresAt", e.target.value)}
                              />
                            </div>

                            <div className={styles.formField}>
                              <label className={styles.formLabel}>Verification URL</label>
                              <input
                                className={styles.formInput}
                                type="url"
                                value={editingDraft.verificationUrl ?? ""}
                                onChange={(e) => setEditField("verificationUrl", e.target.value)}
                              />
                            </div>
                          </div>

                          <div className={styles.formActions}>
                            <button onClick={onUpdateCertificate} disabled={certBusy} className={styles.saveBtn}>
                              {certBusy ? "Saving..." : "Save changes"}
                            </button>
                            <button onClick={cancelEdit} disabled={certBusy} className={styles.cancelBtn}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
    </>
  );
}
