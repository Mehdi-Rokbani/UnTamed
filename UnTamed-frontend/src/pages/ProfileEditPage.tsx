import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as UserApi from "../api/user.api";
import styles from "../style/ProfileEditPage.module.css";
import { Header } from "../components/Header";

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileEditPage() {
  const { user, refreshMe } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [prefsText, setPrefsText] = useState("");
  const [level, setLevel] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isUserRole = user?.role === "USER";

  // ── Populate form ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setPhoneNumber(user.phoneNumber ?? "");
    setBio(user.bio ?? "");
    setLevel(user.level ?? "");
    setPrefsText((user.preferences ?? []).join(", "));
    setPreviewUrl(user.profileImageUrl ?? null);
  }, [user]);

  // ── File preview ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const prefs = useMemo(() => {
    return prefsText.split(",").map((s) => s.trim()).filter(Boolean);
  }, [prefsText]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    setErr(null);
    try {
      await UserApi.updateMe({
        username: username.trim() || undefined,
        phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : null,
        bio: bio.trim() ? bio.trim() : null,
        preferences: prefs,
        level: isUserRole ? (level ? level : null) : undefined,
      });
      if (file) await UserApi.uploadProfilePicture(file);
      await refreshMe();
      // replace: true prevents the edit page from sitting in history,
      // so clicking back on /profile goes to wherever the user was before.
      nav("/profile", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => nav("/profile", { replace: true });

  if (!user) return <div className={styles.loading}>Not authenticated</div>;

  return (
    <>
      <Header />

      <div className={styles.pageWrapper}>
        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderInner}>
            <button className={styles.backButton} onClick={handleBack} aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className={styles.pageTitle}>Edit profile</h1>
          </div>
        </div>

        {/* ── Layout ────────────────────────────────────────────────────── */}
        <div className={styles.layout}>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h2 className={styles.sidebarTitle}>Your public profile</h2>
              <p className={styles.sidebarText}>
                Your name, photo, and bio are visible to other members and guides.
                Keep it friendly and accurate so the community can trust you.
              </p>
            </div>
          </aside>

          {/* Main */}
          <main className={styles.main}>

            {/* Error */}
            {err && (
              <div className={styles.errorBanner}>
                <AlertIcon />
                {err}
              </div>
            )}

            {/* ── Avatar ──────────────────────────────────────────────── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Photo</h3>
              </div>
              <div className={styles.avatarRow}>
                <div className={styles.avatarWrap}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Profile" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {username.slice(0, 1).toUpperCase() || "U"}
                    </div>
                  )}
                  <label className={styles.avatarEditBtn} aria-label="Change photo">
                    <CameraIcon />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className={styles.fileInput}
                    />
                  </label>
                </div>
                <div className={styles.avatarHint}>
                  <p className={styles.avatarHintTitle}>Upload a profile photo</p>
                  <p className={styles.avatarHintSub}>JPG, PNG or WebP · Max 5 MB</p>
                </div>
              </div>
            </div>

            {/* ── Personal info ────────────────────────────────────────── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Personal information</h3>
              </div>

              <div className={styles.fieldGrid}>
                {/* Username */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_username"
                    className={styles.input}
                  />
                </div>

                {/* Phone */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className={styles.input}
                  />
                </div>

                {/* Level — USER only, full width */}
                {isUserRole && (
                  <div className={`${styles.field} ${styles.fieldFull}`}>
                    <label className={styles.label} htmlFor="level">Experience level</label>
                    <select
                      id="level"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Select level</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                      <option value="EXPERT">Expert</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* ── About ───────────────────────────────────────────────── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>About you</h3>
                <span className={styles.cardHint}>Visible on your public profile</span>
              </div>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others a bit about yourself — your passions, adventures, what makes you unique..."
                className={styles.textarea}
                rows={4}
              />
            </div>

            {/* ── Interests ───────────────────────────────────────────── */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Interests</h3>
                <span className={styles.cardHint}>Separate with commas</span>
              </div>
              <input
                id="preferences"
                type="text"
                value={prefsText}
                onChange={(e) => setPrefsText(e.target.value)}
                placeholder="hiking, photography, cooking"
                className={styles.input}
              />
              {prefs.length > 0 && (
                <div className={styles.tagRow}>
                  {prefs.map((p, i) => (
                    <span key={i} className={styles.tag}>{p}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className={styles.actions}>
              <button onClick={onSave} disabled={saving} className={styles.saveBtn}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button onClick={handleBack} disabled={saving} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>

          </main>
        </div>
      </div>
    </>
  );
}