import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  ActivityImage,
  Difficulty,
  ActivityTemplateCreatePayload,
  ActivityTemplateResponse,
  ActivitySessionCreatePayload,
} from "../types/activity";
import type { AddressResponse } from "../types/geo";
import type { Category } from "../types/category";

import { addTemplateImage, createTemplate, createSession } from "../api/activity.api";
import { listCategories } from "../api/category.api";

import LocationPicker from "../components/LocationPicker";
import { Header } from "../components/Header";
import styles from "../style/createActivity.module.css";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Form state
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [price, setPrice] = useState<number>(0);

  // session fields (Design A)
  const [date, setDate] = useState<string>("");
  const [capacity, setCapacity] = useState<number>(3);

  // Categories (required)
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  // Location
  const [location, setLocation] = useState<AddressResponse | null>(null);

  // After template creation
  const [createdTemplate, setCreatedTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [images, setImages] = useState<ActivityImage[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Load categories
  useEffect(() => {
    listCategories({ activeOnly: true })
      .then((cats) => {
        const sorted = [...cats].sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
          return (a.name ?? "").localeCompare(b.name ?? "");
        });
        setCategories(sorted);
      })
      .catch(() => setCategories([]));
  }, []);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Validation per step
  const step1Valid = title.trim().length > 2 && description.trim().length > 5;
  const step2Valid = !!difficulty && price >= 0;
  const step3Valid = !!date && capacity >= 3; // first session
  const step4Valid = categoryIds.length > 0;
  const step5Valid = location !== null;
  const step6Valid = images.length > 0;

  const canCreateTemplate = step1Valid && step2Valid && step4Valid && step5Valid;

  const progressSteps = useMemo(
    () => [
      { n: 1, title: "Basic Info", desc: "Title & Description" },
      { n: 2, title: "Details", desc: "Difficulty & Price" },
      { n: 3, title: "Schedule", desc: "First Date & Capacity" },
      { n: 4, title: "Categories", desc: "Select at least one" },
      { n: 5, title: "Location", desc: "Pick a place" },
      { n: 6, title: "Images", desc: "Upload photos" },
    ],
    []
  );

  const nextStep = () => {
    if (step < 6) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  // Step 5: create TEMPLATE (not session yet)
  async function onCreateTemplate(): Promise<boolean> {
    setStatus(null);

    if (!canCreateTemplate || !location) {
      setStatus("Please complete all required steps before continuing.");
      return false;
    }

    const payload: ActivityTemplateCreatePayload = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      price,
      categoryIds,
      tags: [], // add tags later if you want
      address: {
        provider: location.provider,
        providerPlaceId: location.providerPlaceId,
        displayName: location.displayName,
        latitude: location.latitude,
        longitude: location.longitude,
        governorate: location.governorate ?? null,
        delegation: location.delegation ?? null,
        locality: location.locality ?? null,
      },
      images: [],
    };

    try {
      setSubmitting(true);
      const res = await createTemplate(payload);
      setCreatedTemplate(res);
      setImages(res.images ?? []);
      setStatus("Template created. Now upload pictures.");
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create template");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Step 5 Next: create template then advance to step 6
  async function handleStep5Next() {
    if (createdTemplate) {
      setStep(6);
      return;
    }
    const ok = await onCreateTemplate();
    if (ok) setStep(6);
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!createdTemplate?.id) {
      setStatus("Create the template first.");
      return;
    }

    setStatus(null);
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const updated = await addTemplateImage(createdTemplate.id, file, {
          cover: i === 0 && images.length === 0,
          alt: title.trim() || "Activity image",
        });
        setCreatedTemplate(updated);
        setImages(updated.images ?? []);
      }
      setStatus("Images uploaded successfully ✅");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to upload images");
    } finally {
      setUploading(false);
    }
  }

  // Finish: create FIRST SESSION then navigate
  async function onFinish() {
    setStatus(null);

    if (!createdTemplate?.id) {
      setStatus("Template not created.");
      return;
    }
    if (!step3Valid) {
      setStatus("Please set a valid date and capacity.");
      return;
    }
    if (!step6Valid) {
      setStatus("Please upload at least one image.");
      return;
    }

    const body: ActivitySessionCreatePayload = {
      date: new Date(date).toISOString(),
      capacity,
    };

    try {
      setSubmitting(true);
      await createSession(createdTemplate.id, body);
      navigate("/home");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStep(1);
    setTitle("");
    setDescription("");
    setDifficulty("EASY");
    setPrice(0);
    setDate("");
    setCapacity(3);
    setCategoryIds([]);
    setLocation(null);
    setCreatedTemplate(null);
    setImages([]);
    setStatus(null);
    setSubmitting(false);
    setUploading(false);
  }

  // Helper: image URL vs emoji
  const isImageUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
  };

  return (
    <>
      <Header />
      <div className={styles.createActivityPage}>
        <div className={styles.leftPanel}>
          <div className={styles.leftContent}>
            <h1 className={styles.pageTitle}>Create New Adventure</h1>

            <div className={styles.progressSteps}>
              {progressSteps.map((s) => (
                <div
                  key={s.n}
                  className={`${styles.progressStep} ${step >= (s.n as Step) ? styles.active : ""} ${
                    step > (s.n as Step) ? styles.completed : ""
                  }`}
                >
                  <div className={styles.stepNumber}>{s.n}</div>
                  <div className={styles.stepInfo}>
                    <div className={styles.stepTitle}>{s.title}</div>
                    <div className={styles.stepDesc}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.decorativeQuote}>
              <svg className={styles.quoteIcon} width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
              </svg>
              <p>Every great adventure starts with a single step</p>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className={styles.rightPanel}>
          <form className={styles.activityForm} onSubmit={(e) => e.preventDefault()}>
            {/* Step 1 */}
            {step === 1 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Tell us about your adventure</h2>
                <p className={styles.stepSubheading}>Give your activity a compelling title and description</p>

                <div className={styles.formGroup}>
                  <label htmlFor="title">Activity Title</label>
                  <input
                    id="title"
                    type="text"
                    className={styles.formInput}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Mountain Hiking in Ain Draham"
                  />
                  <div className={styles.inputHint}>{title.length}/50 characters</div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    className={styles.formTextarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the route, what to bring, what's included..."
                    rows={6}
                  />
                  <div className={styles.inputHint}>Be detailed - help adventurers know what to expect</div>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Activity details</h2>
                <p className={styles.stepSubheading}>Set the difficulty level and pricing</p>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="difficulty">Difficulty Level</label>
                    <select
                      id="difficulty"
                      className={styles.formSelect}
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    >
                      <option value="EASY">🟢 Easy - Beginners welcome</option>
                      <option value="MEDIUM">🟡 Medium - Some experience needed</option>
                      <option value="HARD">🔴 Hard - Advanced only</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="price">Price per Person (TND)</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>💰</span>
                      <input
                        id="price"
                        type="number"
                        className={styles.formInput}
                        min={0}
                        step={0.01}
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className={styles.inputHint}>Free activities should be set to 0</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>First date and capacity</h2>
                <p className={styles.stepSubheading}>You can add more dates later from sessions</p>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="date">Date & Time</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>📅</span>
                      <input
                        id="date"
                        type="datetime-local"
                        className={styles.formInput}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="capacity">Group Capacity</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>👥</span>
                      <input
                        id="capacity"
                        type="number"
                        className={styles.formInput}
                        min={3}
                        value={capacity}
                        onChange={(e) => setCapacity(Number(e.target.value))}
                      />
                    </div>
                    <div className={styles.inputHint}>Minimum 3 participants required</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Categories */}
            {step === 4 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Choose categories</h2>
                <p className={styles.stepSubheading}>Select at least one category for your activity</p>

                <div className={styles.categoryGrid}>
                  {categories.map((c) => {
                    const selected = categoryIds.includes(c.id);
                    const icon = c.iconUrl ?? null;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`${styles.categoryCard} ${selected ? styles.selected : ""}`}
                        onClick={() => toggleCategory(c.id)}
                        aria-pressed={selected}
                      >
                        <div className={styles.categoryIcon}>
                          {icon && isImageUrl(icon) ? <img src={icon} alt={c.name ?? "Category icon"} /> : <span>{icon ?? "📦"}</span>}
                        </div>
                        <div className={styles.categoryTitle}>{c.name}</div>
                        {c.description && <div className={styles.categoryDesc}>{c.description}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Location (creates template on Next) */}
            {step === 5 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Where's the adventure?</h2>
                <p className={styles.stepSubheading}>Search and select the meeting location</p>

                <div className={styles.locationWrapper}>
                  <LocationPicker value={location} onChange={setLocation} label="Meeting Point" />
                </div>

                {location && (
                  <div className={styles.locationPreview}>
                    <div className={styles.previewHeader}>
                      <strong>✅ Selected Location</strong>
                    </div>
                    <div className={styles.previewName}>{location.displayName}</div>
                    <div className={styles.previewCoords}>
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Images (upload to template) */}
            {step === 6 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Upload pictures</h2>
                <p className={styles.stepSubheading}>Add a cover photo and gallery images for your activity.</p>

                {!createdTemplate?.id ? (
                  <div className={styles.infoCard}>
                    <div>Something went wrong. Please go back and try again.</div>
                  </div>
                ) : (
                  <>
                    <div className={styles.formGroup}>
                      <label htmlFor="images">Select images</label>
                      <input
                        id="images"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={uploading}
                        onChange={(e) => onUploadFiles(e.target.files)}
                      />
                      <div className={styles.inputHint}>JPG / PNG / WEBP (max 5MB each)</div>
                    </div>

                    {images.length > 0 && (
                      <div className={styles.locationPreview} style={{ marginTop: 12 }}>
                        <div className={styles.previewHeader}>
                          <strong>Uploaded images</strong>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
                          {images
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((img) => (
                              <div key={img.publicId ?? img.url} style={{ borderRadius: 12, overflow: "hidden" }}>
                                <div style={{ position: "relative" }}>
                                  <img
                                    src={img.url}
                                    alt={img.alt ?? "Activity image"}
                                    style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                                  />
                                  {img.cover && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: 8,
                                        left: 8,
                                        background: "rgba(0,0,0,0.6)",
                                        color: "white",
                                        padding: "4px 8px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                      }}
                                    >
                                      Cover
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.infoCard} style={{ marginTop: 12 }}>
                      <div>Tip: Upload your best photo first — it will become the cover automatically.</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Status Message */}
            {status && (
              <div className={`${styles.statusMessage} ${status.includes("✅") ? styles.success : styles.error}`}>{status}</div>
            )}

            {/* Navigation */}
            <div className={styles.formNavigation}>
              {step > 1 && (
                <button type="button" className={styles.navBtnSecondary} onClick={prevStep} disabled={submitting || uploading}>
                  Previous
                </button>
              )}

              <div className={styles.navSpacer} />

              {/* Steps 1–4: Next */}
              {step >= 1 && step <= 4 && (
                <button
                  type="button"
                  className={styles.navBtnPrimary}
                  onClick={nextStep}
                  disabled={
                    submitting ||
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid) ||
                    (step === 4 && !step4Valid)
                  }
                >
                  Next
                </button>
              )}

              {/* Step 5: Next creates template */}
              {step === 5 && (
                <button type="button" className={styles.navBtnPrimary} onClick={handleStep5Next} disabled={!step5Valid || submitting}>
                  {submitting ? "Creating..." : "Next"}
                </button>
              )}

              {/* Step 6: Finish creates first session */}
              {step === 6 && (
                <button
                  type="button"
                  className={styles.navBtnPrimarySubmit}
                  disabled={uploading || submitting || !createdTemplate?.id || !step6Valid}
                  onClick={onFinish}
                >
                  {submitting ? "Finishing..." : "Finish"}
                </button>
              )}
            </div>

            {createdTemplate?.id && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className={styles.navBtnSecondary} onClick={resetAll} disabled={submitting || uploading}>
                  Start Over
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}