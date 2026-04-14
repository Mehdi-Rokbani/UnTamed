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
import { generateActivityDraft } from "../api/assistant.api";
import { listCategories } from "../api/category.api";

import LocationPicker from "../components/LocationPicker";
import { Header } from "../components/Header";
import styles from "../style/createActivity.module.css";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

/* ── SVG icon helpers ── */
function IconCalendar() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconCurrency() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
function IconArrowLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
function IconSparkles() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
      <path d="M5 17v4" />
      <path d="M7 19H3" />
    </svg>
  );
}

const isImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
};

/* ── Difficulty config ── */
const DIFFICULTY_OPTIONS = [
  {
    value: "EASY" as Difficulty,
    label: "Easy",
    sub: "Beginners welcome",
    cardClass: styles.difficultyEasy,
  },
  {
    value: "MEDIUM" as Difficulty,
    label: "Medium",
    sub: "Some experience needed",
    cardClass: styles.difficultyMedium,
  },
  {
    value: "HARD" as Difficulty,
    label: "Hard",
    sub: "Advanced only",
    cardClass: styles.difficultyHard,
  },
] as const;

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [price, setPrice] = useState<number>(0);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [capacity, setCapacity] = useState<number>(3);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [sessionNote, setSessionNote] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [location, setLocation] = useState<AddressResponse | null>(null);

  const [createdTemplate, setCreatedTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [images, setImages] = useState<ActivityImage[]>([]);

  const [aiIdea, setAiIdea] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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

  const toggleCategory = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const step1Valid = title.trim().length > 2 && description.trim().length > 5;
  const step2Valid = !!difficulty && price >= 0;
  const step3Valid =
    !!startAt &&
    !!endAt &&
    new Date(startAt).getTime() > Date.now() &&
    new Date(endAt).getTime() > new Date(startAt).getTime() &&
    capacity >= 3;
  const step4Valid = categoryIds.length > 0;
  const step5Valid = location !== null;
  const step6Valid = images.length > 0;
  const canCreateTemplate = step1Valid && step2Valid && step4Valid && step5Valid;

  const progressSteps = useMemo(
    () => [
      { n: 1, title: "Basic Info", desc: "Title & Description" },
      { n: 2, title: "Details", desc: "Difficulty & Price" },
      { n: 3, title: "Schedule", desc: "Session timing" },
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

  async function handleGenerateAI() {
    if (!aiIdea.trim()) return;

    try {
      setAiLoading(true);
      setStatus(null);

      const res = await generateActivityDraft({
        idea: aiIdea.trim(),
      });

      setTitle(res.title);
      setDescription(res.description);
      setDifficulty(res.difficulty);

      setStatus("AI draft generated ✅ You can edit it before continuing.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

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
      tags: [],
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

  async function onFinish() {
    setStatus(null);

    if (!createdTemplate?.id) {
      setStatus("Template not created.");
      return;
    }
    if (!step3Valid) {
      setStatus("Please set valid start/end time and capacity.");
      return;
    }
    if (!step6Valid) {
      setStatus("Please upload at least one image.");
      return;
    }

    const body: ActivitySessionCreatePayload = {
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      capacity,
      meetingPoint: meetingPoint.trim() || undefined,
      sessionNote: sessionNote.trim() || undefined,
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
    setStartAt("");
    setEndAt("");
    setCapacity(3);
    setMeetingPoint("");
    setSessionNote("");
    setCategoryIds([]);
    setLocation(null);
    setCreatedTemplate(null);
    setImages([]);
    setAiIdea("");
    setStatus(null);
    setSubmitting(false);
    setUploading(false);
    setAiLoading(false);
  }

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
                  className={[
                    styles.progressStep,
                    step >= s.n ? styles.active : "",
                    step > s.n ? styles.completed : "",
                  ].join(" ")}
                >
                  <div className={styles.stepNumber}>{step > s.n ? <IconCheck /> : s.n}</div>
                  <div className={styles.stepInfo}>
                    <div className={styles.stepTitle}>{s.title}</div>
                    <div className={styles.stepDesc}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.decorativeQuote}>
              <svg className={styles.quoteIcon} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
              </svg>
              <p>Every great adventure starts with a single step</p>
            </div>
          </div>
        </div>

        <div className={styles.rightPanel}>
          <form className={styles.activityForm} onSubmit={(e) => e.preventDefault()}>
            {step === 1 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Tell us about your adventure</h2>
                <p className={styles.stepSubheading}>Give your activity a compelling title and description</p>

                <div className={styles.formGroup}>
                  <label htmlFor="aiIdea">Describe your idea (AI assistant)</label>
                  <textarea
                    id="aiIdea"
                    className={styles.formTextarea}
                    value={aiIdea}
                    onChange={(e) => setAiIdea(e.target.value)}
                    placeholder="e.g., forest walk in ain draham with waterfall and medium effort"
                    rows={3}
                  />
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={styles.navBtnSecondary}
                      onClick={handleGenerateAI}
                      disabled={aiLoading || !aiIdea.trim()}
                    >
                      {aiLoading ? (
                        "Generating..."
                      ) : (
                        <>
                          <IconSparkles /> Generate with AI
                        </>
                      )}
                    </button>
                  </div>
                  <div className={styles.inputHint}>
                    Let AI generate a title, description, and difficulty for you
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="title">Activity Title</label>
                  <input
                    id="title"
                    type="text"
                    className={styles.formInput}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Mountain Hiking in Ain Draham"
                    maxLength={80}
                  />
                  <div className={styles.inputHint}>{title.length} / 80 characters</div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    className={styles.formTextarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the route, what to bring, what's included…"
                    rows={5}
                  />
                  <div className={styles.inputHint}>Be detailed — help adventurers know what to expect</div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Activity details</h2>
                <p className={styles.stepSubheading}>Set the difficulty level and pricing</p>

                <div className={styles.formGroup}>
                  <label>Difficulty Level</label>
                  <div className={styles.difficultyGroup}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        className={[
                          styles.difficultyCard,
                          d.cardClass,
                          difficulty === d.value ? styles.difficultySelected : "",
                        ].join(" ")}
                        onClick={() => setDifficulty(d.value)}
                      >
                        <span className={styles.difficultyDot} />
                        <span className={styles.difficultyLabel}>{d.label}</span>
                        <span className={styles.difficultySub}>{d.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="price">Price per Person (TND)</label>
                  <div className={styles.inputWithIcon}>
                    <span className={styles.inputIcon}>
                      <IconCurrency />
                    </span>
                    <input
                      id="price"
                      type="number"
                      className={styles.formInput}
                      min={0}
                      step={0.5}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.inputHint}>Set to 0 for free activities</div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Schedule your first session</h2>
                <p className={styles.stepSubheading}>Set the session time, group size, and optional details</p>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="startAt">Start Date &amp; Time</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>
                        <IconCalendar />
                      </span>
                      <input
                        id="startAt"
                        type="datetime-local"
                        className={styles.formInput}
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="endAt">End Date &amp; Time</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>
                        <IconCalendar />
                      </span>
                      <input
                        id="endAt"
                        type="datetime-local"
                        className={styles.formInput}
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                      />
                    </div>
                    <div className={styles.inputHint}>End time must be after start time</div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="capacity">Group Capacity</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}>
                        <IconUsers />
                      </span>
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

                <div className={styles.formGroup}>
                  <label htmlFor="meetingPoint">Meeting Point (optional)</label>
                  <input
                    id="meetingPoint"
                    type="text"
                    className={styles.formInput}
                    value={meetingPoint}
                    onChange={(e) => setMeetingPoint(e.target.value)}
                    placeholder="e.g., Main parking, café entrance, trail gate..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="sessionNote">Session Notes (optional)</label>
                  <textarea
                    id="sessionNote"
                    className={styles.formTextarea}
                    value={sessionNote}
                    onChange={(e) => setSessionNote(e.target.value)}
                    placeholder="Add useful participant info such as what to bring, exact meetup tips, or special instructions..."
                    rows={4}
                  />
                </div>
              </div>
            )}

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
                          {icon && isImageUrl(icon) ? (
                            <img src={icon} alt={c.name ?? "Category"} />
                          ) : (
                            <span>{icon ?? "📦"}</span>
                          )}
                        </div>
                        <div className={styles.categoryTitle}>{c.name}</div>
                        {c.description && <div className={styles.categoryDesc}>{c.description}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Where's the adventure?</h2>
                <p className={styles.stepSubheading}>Search or click the map to set the meeting point</p>

                <div className={styles.locationWrapper}>
                  <LocationPicker value={location} onChange={setLocation} label="Meeting Point" />
                </div>

                {location && (
                  <div className={styles.locationPreview}>
                    <div className={styles.previewHeader}>
                      <IconCheck /> Location confirmed
                    </div>
                    <div className={styles.previewName}>{location.displayName}</div>
                    <div className={styles.previewCoords}>
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 6 && (
              <div className={styles.formStep}>
                <h2 className={styles.stepHeading}>Upload pictures</h2>
                <p className={styles.stepSubheading}>Add a cover photo and gallery images for your activity</p>

                {!createdTemplate?.id ? (
                  <div className={styles.infoCard}>Something went wrong. Please go back and try again.</div>
                ) : (
                  <>
                    <div className={styles.formGroup}>
                      <label htmlFor="images">Select images</label>
                      <input
                        id="images"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className={styles.formInput}
                        disabled={uploading}
                        onChange={(e) => onUploadFiles(e.target.files)}
                      />
                      <div className={styles.inputHint}>JPG / PNG / WEBP — max 5 MB each</div>
                    </div>

                    {images.length > 0 && (
                      <div className={styles.locationPreview}>
                        <div className={styles.previewHeader}>
                          <IconCheck /> {images.length} image{images.length > 1 ? "s" : ""} uploaded
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: 10,
                            marginTop: 12,
                          }}
                        >
                          {images
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((img) => (
                              <div
                                key={img.publicId ?? img.url}
                                style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}
                              >
                                <img
                                  src={img.url}
                                  alt={img.alt ?? "Activity image"}
                                  style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
                                />
                                {img.cover && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 6,
                                      left: 6,
                                      background: "rgba(26,77,46,0.85)",
                                      backdropFilter: "blur(4px)",
                                      color: "white",
                                      padding: "3px 9px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 700,
                                    }}
                                  >
                                    Cover
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.infoCard} style={{ marginTop: 14 }}>
                      Tip: the first photo you upload becomes the cover automatically.
                    </div>
                  </>
                )}
              </div>
            )}

            {status && (
              <div className={`${styles.statusMessage} ${status.includes("✅") ? styles.success : styles.error}`}>
                {status}
              </div>
            )}

            <div className={styles.formNavigation}>
              {step > 1 && (
                <button
                  type="button"
                  className={styles.navBtnSecondary}
                  onClick={prevStep}
                  disabled={submitting || uploading || aiLoading}
                >
                  <IconArrowLeft /> Previous
                </button>
              )}

              <div className={styles.navSpacer} />

              {step >= 1 && step <= 4 && (
                <button
                  type="button"
                  className={styles.navBtnPrimary}
                  onClick={nextStep}
                  disabled={
                    submitting ||
                    uploading ||
                    aiLoading ||
                    (step === 1 && !step1Valid) ||
                    (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid) ||
                    (step === 4 && !step4Valid)
                  }
                >
                  Next <IconArrowRight />
                </button>
              )}

              {step === 5 && (
                <button
                  type="button"
                  className={styles.navBtnPrimary}
                  onClick={handleStep5Next}
                  disabled={!step5Valid || submitting || aiLoading}
                >
                  {submitting ? (
                    "Creating…"
                  ) : (
                    <>
                      Next <IconArrowRight />
                    </>
                  )}
                </button>
              )}

              {step === 6 && (
                <button
                  type="button"
                  className={styles.navBtnPrimarySubmit}
                  disabled={uploading || submitting || aiLoading || !createdTemplate?.id || !step6Valid}
                  onClick={onFinish}
                >
                  {submitting ? (
                    "Publishing…"
                  ) : (
                    <>
                      <IconFlag /> Publish Adventure
                    </>
                  )}
                </button>
              )}
            </div>

            {createdTemplate?.id && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className={styles.navBtnSecondary}
                  onClick={resetAll}
                  disabled={submitting || uploading || aiLoading}
                >
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