import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth.store";
import * as UserApi from "../api/user.api";
import styles from "../style/ProfileEditPage.module.css";
import { Header } from "../components/Header";

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

  useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setPhoneNumber(user.phoneNumber ?? "");
    setBio(user.bio ?? "");
    setLevel(user.level ?? "");
    setPrefsText((user.preferences ?? []).join(", "));
    setPreviewUrl(user.profileImageUrl ?? null);
  }, [user]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const prefs = useMemo(() => {
    return prefsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [prefsText]);

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

      if (file) {
        await UserApi.uploadProfilePicture(file);
      }

      await refreshMe();
      nav("/profile");
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div className={styles.loading}>Not authenticated</div>;

  return (
    <>
    <Header></Header>
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => nav("/profile")} className={styles.backButton}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={styles.title}>My profile</h1>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarText}>
            Hosts and guests can see your profile and it may appear across Airbnb to help us build trust in our community.
          </p>
        </aside>

        <main className={styles.main}>
          {err && (
            <div className={styles.errorBanner}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {err}
            </div>
          )}

          {/* Photo Upload */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.avatarContainer}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Profile" className={styles.avatarPreview} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {username.slice(0, 1).toUpperCase() || "U"}
                  </div>
                )}
                <label className={styles.uploadButton}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className={styles.fileInput}
                  />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Add
                </label>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className={styles.section}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <label htmlFor="username">Username</label>
              </div>
              <div className={styles.fieldInput}>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className={styles.section}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <label htmlFor="phone">Phone number</label>
                <p className={styles.fieldHint}>Add your phone number</p>
              </div>
              <div className={styles.fieldInput}>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className={styles.section}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <label htmlFor="bio">About you</label>
                <p className={styles.fieldHint}>Write a little bit about yourself</p>
              </div>
              <div className={styles.fieldInput}>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others a bit about yourself..."
                  className={styles.textarea}
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className={styles.section}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <label htmlFor="preferences">Interests</label>
                <p className={styles.fieldHint}>Comma separated (e.g., hiking, photography, cooking)</p>
              </div>
              <div className={styles.fieldInput}>
                <input
                  id="preferences"
                  type="text"
                  value={prefsText}
                  onChange={(e) => setPrefsText(e.target.value)}
                  placeholder="hiking, photography, cooking"
                  className={styles.input}
                />
                {prefs.length > 0 && (
                  <div className={styles.tagPreview}>
                    {prefs.map((p, i) => (
                      <span key={i} className={styles.tag}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Level (only for USER role) */}
          {isUserRole && (
            <div className={styles.section}>
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabel}>
                  <label htmlFor="level">Experience level</label>
                  <p className={styles.fieldHint}>Your skill level</p>
                </div>
                <div className={styles.fieldInput}>
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
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button onClick={onSave} disabled={saving} className={styles.saveButton}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => nav("/profile")} disabled={saving} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </main>
      </div>
    </div>
    </>
  );
  
}