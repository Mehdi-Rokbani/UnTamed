import { useEffect, useMemo, useRef, useState } from "react";
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

type Step    = 1 | 2 | 3 | 4 | 5 | 6;
type UIPhase = "ai-entry" | "form";

/* ── SVG Icons ── */
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconCurrency = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IconFlag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);
const IconSparkles = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 3v4" /><path d="M21 5h-4" /><path d="M5 17v4" /><path d="M7 19H3" />
  </svg>
);
const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const isImageUrl = (url: string | undefined): boolean =>
  !!url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"));

const cleanList = (values: string[] | null | undefined, max = 8): string[] => {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))
  ).slice(0, max);
};

/* ── Difficulty config ── */
const DIFFICULTY_OPTIONS = [
  { value: "EASY"   as Difficulty, label: "Easy",   emoji: "🌿", sub: "Beginners welcome",    cardClass: styles.difficultyEasy },
  { value: "MEDIUM" as Difficulty, label: "Medium", emoji: "⚡", sub: "Some experience needed", cardClass: styles.difficultyMedium },
  { value: "HARD"   as Difficulty, label: "Hard",   emoji: "🔥", sub: "Advanced only",          cardClass: styles.difficultyHard },
] as const;

/* ── AI Example prompts ── */
const AI_EXAMPLES = [
  "forest walk in Ain Draham with a waterfall, medium effort",
  "sunset kayaking in Bizerte for beginners",
  "desert stargazing camp in Douz, 2 days",
];

/* ── TagInput sub-component ── */
interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  isAiFilled?: boolean;
}
function TagInput({ tags, onChange, isAiFilled }: TagInputProps) {
  const [inputVal, setInputVal] = useState("");

  const addTag = (val: string) => {
    const trimmed = val.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !tags.includes(trimmed) && tags.length < 8) {
      onChange([...tags, trimmed]);
    }
    setInputVal("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className={`${styles.tagInputWrapper} ${isAiFilled ? styles.aiFilled : ""}`}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tagChip}>
          #{tag}
          <button type="button" onClick={() => removeTag(tag)} className={styles.tagRemove} aria-label={`Remove ${tag}`}>
            <IconX />
          </button>
        </span>
      ))}
      {tags.length < 8 && (
        <input
          type="text"
          className={styles.tagInlineInput}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(inputVal); }
            if (e.key === "Backspace" && !inputVal && tags.length) removeTag(tags[tags.length - 1]);
          }}
          placeholder={tags.length === 0 ? "Add tags… (press Enter)" : ""}
        />
      )}
    </div>
  );
}

/* ── AI Loading Skeleton ── */
function AISkeleton() {
  return (
    <div className={styles.aiSkeleton}>
      <div className={styles.skeletonLine} style={{ width: "60%", height: 28 }} />
      <div className={styles.skeletonLine} style={{ width: "100%", height: 16, marginTop: 12 }} />
      <div className={styles.skeletonLine} style={{ width: "85%", height: 16, marginTop: 8 }} />
      <div className={styles.skeletonLine} style={{ width: "70%", height: 16, marginTop: 8 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <div className={styles.skeletonLine} style={{ width: 72, height: 28, borderRadius: 99 }} />
        <div className={styles.skeletonLine} style={{ width: 88, height: 28, borderRadius: 99 }} />
        <div className={styles.skeletonLine} style={{ width: 64, height: 28, borderRadius: 99 }} />
      </div>
    </div>
  );
}

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<UIPhase>("ai-entry");
  const [step, setStep]   = useState<Step>(1);

  /* form fields */
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [difficulty, setDifficulty]     = useState<Difficulty>("EASY");
  const [price, setPrice]               = useState<number>(0);
  const [tags, setTags]                 = useState<string[]>([]);
  const [safetyNotes, setSafetyNotes]   = useState<string[]>([]);

  const [startAt, setStartAt]           = useState("");
  const [endAt, setEndAt]               = useState("");
  const [capacity, setCapacity]         = useState<number>(3);
  const [meetingPoint, setMeetingPoint] = useState("");
  const [sessionNote, setSessionNote]   = useState("");

  const [categories, setCategories]         = useState<Category[]>([]);
  const [categoryIds, setCategoryIds]       = useState<string[]>([]);
  const [location, setLocation]             = useState<AddressResponse | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<ActivityTemplateResponse | null>(null);
  const [images, setImages]                 = useState<ActivityImage[]>([]);

  /* AI state */
  const [aiIdea, setAiIdea]                         = useState("");
  const [aiPlace, setAiPlace]                       = useState("");
  const [aiAudience, setAiAudience]                 = useState("");
  const [aiVibe, setAiVibe]                         = useState("");
  const [aiNotes, setAiNotes]                       = useState("");
  const [aiDurationPreference, setAiDurationPreference] = useState("");
  const [aiBudgetStyle, setAiBudgetStyle]           = useState("");
  const [aiWarnings, setAiWarnings]                 = useState<string[]>([]);
  const [aiMissingDetails, setAiMissingDetails]     = useState<string[]>([]);
  const [aiHighlights, setAiHighlights]             = useState<string[]>([]);
  const [aiIncludedItems, setAiIncludedItems]       = useState<string[]>([]);
  const [aiWhatToBring, setAiWhatToBring]           = useState<string[]>([]);
  const [aiRationale, setAiRationale]               = useState<string | null>(null);
  const [aiLoading, setAiLoading]                   = useState(false);
  const [aiFilledFields, setAiFilledFields]         = useState<Set<string>>(new Set());

  /* misc */
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [status, setStatus]         = useState<string | null>(null);
  const formRef                     = useRef<HTMLFormElement>(null);

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

  /* ── Validation ── */
  const step1Valid = title.trim().length > 2 && description.trim().length > 5;
  const step2Valid = !!difficulty && price >= 0;
  const step3Valid =
    !!startAt && !!endAt &&
    new Date(startAt).getTime() > Date.now() &&
    new Date(endAt).getTime() > new Date(startAt).getTime() &&
    capacity >= 3;
  const step4Valid = categoryIds.length > 0;
  const step5Valid = location !== null;
  const step6Valid = images.length > 0;
  const canCreateTemplate = step1Valid && step2Valid && step4Valid && step5Valid;

  /* ── Step progress (0–100) for the header progress bar ── */
  const stepProgress = Math.round(((step - 1) / 5) * 100);

  const progressSteps = useMemo(() => [
    { n: 1 as Step, title: "Basic Info",  desc: "Title & description", emoji: "✍️" },
    { n: 2 as Step, title: "Details",     desc: "Difficulty & price",  emoji: "⚙️" },
    { n: 3 as Step, title: "Schedule",    desc: "Session timing",      emoji: "📅" },
    { n: 4 as Step, title: "Categories",  desc: "Choose tags",         emoji: "🏷️" },
    { n: 5 as Step, title: "Location",    desc: "Meeting point",       emoji: "📍" },
    { n: 6 as Step, title: "Photos",      desc: "Upload images",       emoji: "📸" },
  ], []);

  const nextStep = () => { if (step < 6) setStep((step + 1) as Step); };
  const prevStep = () => {
    if (step > 1) setStep((step - 1) as Step);
    else setPhase("ai-entry");
  };

  /* ── AI generation ── */
  async function handleGenerateAI() {
    if (!aiIdea.trim()) return;

    try {
      setAiLoading(true);
      setStatus(null);

      const res = await generateActivityDraft({
        idea:               aiIdea.trim(),
        targetAudience:     aiAudience.trim() || undefined,
        vibe:               aiVibe.trim() || undefined,
        notes:              aiNotes.trim() || undefined,
        durationPreference: aiDurationPreference.trim() || undefined,
        budgetStyle:        aiBudgetStyle.trim() || undefined,
        placeLabel:         aiPlace.trim() || undefined,
        addressId:          location?.id,
      });

      const warningList   = cleanList(res.warnings, 6);
      const missingList   = cleanList(res.missingDetails, 6);
      const highlightList = cleanList(res.highlights, 6);
      const includedList  = cleanList(res.includedItems, 6);
      const bringList     = cleanList(res.whatToBring, 6);

      setAiWarnings(warningList);
      setAiMissingDetails(missingList);
      setAiHighlights(highlightList);
      setAiIncludedItems(includedList);
      setAiWhatToBring(bringList);
      setAiRationale(res.rationale ?? null);

      if (warningList.length || missingList.length) {
        const preview = [...warningList.slice(0, 2), ...missingList.slice(0, 2)].join(" • ");
        setStatus(preview ? `AI draft ready. Review: ${preview}` : "AI draft generated successfully.");
      }

      setTimeout(() => { setTitle(res.title); setAiFilledFields((p) => new Set([...p, "title"])); }, 250);
      setTimeout(() => { setDescription(res.description); setAiFilledFields((p) => new Set([...p, "description"])); }, 500);
      setTimeout(() => { setDifficulty(res.difficulty); setAiFilledFields((p) => new Set([...p, "difficulty"])); }, 750);

      if (res.tags?.length) {
        setTimeout(() => { setTags(cleanList(res.tags, 8)); setAiFilledFields((p) => new Set([...p, "tags"])); }, 1000);
      }
      if (res.suggestedPriceMin != null) {
        setTimeout(() => { setPrice(Number(res.suggestedPriceMin) || 0); setAiFilledFields((p) => new Set([...p, "price"])); }, 1150);
      }
      if (res.suggestedCapacity != null && res.suggestedCapacity >= 3) {
        setTimeout(() => { setCapacity(res.suggestedCapacity); setAiFilledFields((p) => new Set([...p, "capacity"])); }, 1250);
      }
      if (res.meetingPointSuggestion) {
        setTimeout(() => { setMeetingPoint(res.meetingPointSuggestion ?? ""); setAiFilledFields((p) => new Set([...p, "meetingPoint"])); }, 1350);
      }
      if (res.sessionNoteSuggestion) {
        setTimeout(() => { setSessionNote(res.sessionNoteSuggestion ?? ""); setAiFilledFields((p) => new Set([...p, "sessionNote"])); }, 1450);
      }
      if (res.suggestedCategoryIds?.length) {
        setTimeout(() => {
          setCategoryIds((prev) => {
            const valid  = new Set(categories.map((c) => c.id));
            const merged = Array.from(new Set([...prev, ...res.suggestedCategoryIds.filter((id) => valid.has(id))]));
            return merged;
          });
          setAiFilledFields((p) => new Set([...p, "categories"]));
        }, 1550);
      }
      if (!location && aiPlace.trim()) {
        setTimeout(() => { setStatus("AI draft ready. Pick the exact location on the map before continuing."); }, 1650);
      }
      if (!safetyNotes.length && (warningList.length || bringList.length)) {
        setSafetyNotes(cleanList([...warningList, ...bringList], 8));
      }

      setTimeout(() => { setPhase("form"); setStep(1); }, 1750);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "AI generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleSkipAI() {
    setAiFilledFields(new Set());
    setAiWarnings([]);
    setAiMissingDetails([]);
    setAiHighlights([]);
    setAiIncludedItems([]);
    setAiWhatToBring([]);
    setAiRationale(null);
    setPhase("form");
    setStep(1);
  }

  function handleFieldEdit(field: string) {
    setAiFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  /* ── Template & session creation ── */
  async function onCreateTemplate(): Promise<boolean> {
    setStatus(null);
    if (!canCreateTemplate || !location) {
      setStatus("Please complete all required steps before continuing.");
      return false;
    }

    const payload: ActivityTemplateCreatePayload = {
      title:       title.trim(),
      description: description.trim(),
      difficulty,
      price,
      categoryIds,
      tags,
      safetyNotes,
      address: {
        provider:        location.provider,
        providerPlaceId: location.providerPlaceId,
        displayName:     location.displayName,
        latitude:        location.latitude,
        longitude:       location.longitude,
        governorate:     location.governorate ?? null,
        delegation:      location.delegation ?? null,
        locality:        location.locality ?? null,
      },
      images: [],
    };

    try {
      setSubmitting(true);
      const res = await createTemplate(payload);
      setCreatedTemplate(res);
      setImages(res.images ?? []);
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create template");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep5Next() {
    if (createdTemplate) { setStep(6); return; }
    const ok = await onCreateTemplate();
    if (ok) setStep(6);
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !createdTemplate?.id) return;
    setStatus(null);
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const updated = await addTemplateImage(createdTemplate.id, files[i], {
          cover: i === 0 && images.length === 0,
          alt:   title.trim() || "Activity image",
        });
        setCreatedTemplate(updated);
        setImages(updated.images ?? []);
      }
      setStatus("✅ Images uploaded successfully");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to upload images");
    } finally {
      setUploading(false);
    }
  }

  async function onFinish() {
    setStatus(null);
    if (!createdTemplate?.id || !step3Valid || !step6Valid) {
      setStatus("Please complete all required fields.");
      return;
    }
    const body: ActivitySessionCreatePayload = {
      startAt:      new Date(startAt).toISOString(),
      endAt:        new Date(endAt).toISOString(),
      capacity,
      meetingPoint: meetingPoint.trim() || undefined,
      sessionNote:  sessionNote.trim() || undefined,
    };
    try {
      setSubmitting(true);
      await createSession(createdTemplate.id, body);
      navigate("/home");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to publish activity");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setPhase("ai-entry");
    setStep(1);
    setTitle(""); setDescription(""); setDifficulty("EASY"); setPrice(0); setTags([]); setSafetyNotes([]);
    setStartAt(""); setEndAt(""); setCapacity(3); setMeetingPoint(""); setSessionNote("");
    setCategoryIds([]); setLocation(null); setCreatedTemplate(null); setImages([]);
    setAiIdea(""); setAiPlace(""); setAiAudience(""); setAiVibe(""); setAiNotes("");
    setAiDurationPreference(""); setAiBudgetStyle("");
    setAiWarnings([]); setAiMissingDetails([]); setAiHighlights([]);
    setAiIncludedItems([]); setAiWhatToBring([]); setAiRationale(null);
    setAiFilledFields(new Set());
    setStatus(null); setSubmitting(false); setUploading(false); setAiLoading(false);
  }

  /* ════════════════════════════════════════
     AI ENTRY PHASE
  ════════════════════════════════════════ */
  if (phase === "ai-entry") {
    return (
      <>
        <Header opaque />
        <div className={styles.aiEntryPage}>
          <div className={styles.orb1} /><div className={styles.orb2} />

          <div className={styles.aiEntryCard}>
            <div className={styles.aiCardHeader}>
              <div className={styles.aiIconBadge}><IconSparkles /></div>
              <div>
                <h1 className={styles.aiCardTitle}>Create your adventure</h1>
                <p className={styles.aiCardSubtitle}>Describe your idea and let AI do the heavy lifting</p>
              </div>
            </div>

            <div className={styles.aiMainInputGroup}>
              <label className={styles.aiLabel}>What's your adventure idea?</label>
              <textarea
                className={styles.aiMainTextarea}
                value={aiIdea}
                onChange={(e) => setAiIdea(e.target.value)}
                placeholder="e.g., forest walk in Ain Draham with a waterfall, medium effort, guided tour…"
                rows={3}
                disabled={aiLoading}
              />
              <div className={styles.exampleChips}>
                {AI_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className={styles.exampleChip}
                    onClick={() => setAiIdea(ex)} disabled={aiLoading}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.aiExtrasGrid}>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>📍 Place label</label>
                <input className={styles.aiExtraInput} value={aiPlace}
                  onChange={(e) => setAiPlace(e.target.value)}
                  placeholder="Ain Draham, Bizerte…" disabled={aiLoading} />
              </div>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>👥 Audience</label>
                <input className={styles.aiExtraInput} value={aiAudience}
                  onChange={(e) => setAiAudience(e.target.value)}
                  placeholder="Friends, beginners…" disabled={aiLoading} />
              </div>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>✨ Vibe</label>
                <input className={styles.aiExtraInput} value={aiVibe}
                  onChange={(e) => setAiVibe(e.target.value)}
                  placeholder="Relaxing, adventurous…" disabled={aiLoading} />
              </div>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>📝 Notes</label>
                <input className={styles.aiExtraInput} value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  placeholder="Guided, equipment needed…" disabled={aiLoading} />
              </div>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>⏱ Duration</label>
                <input className={styles.aiExtraInput} value={aiDurationPreference}
                  onChange={(e) => setAiDurationPreference(e.target.value)}
                  placeholder="short, half-day, full-day…" disabled={aiLoading} />
              </div>
              <div className={styles.aiExtraField}>
                <label className={styles.aiLabelSm}>💰 Budget style</label>
                <input className={styles.aiExtraInput} value={aiBudgetStyle}
                  onChange={(e) => setAiBudgetStyle(e.target.value)}
                  placeholder="budget, standard, premium…" disabled={aiLoading} />
              </div>
            </div>

            {aiLoading && <AISkeleton />}

            {status && !aiLoading && (
              <div className={`${styles.statusPill} ${status.includes("✅") ? styles.success : styles.error}`}>
                {status}
              </div>
            )}

            <div className={styles.aiActions}>
              <button type="button" className={styles.aiGenerateBtn}
                onClick={handleGenerateAI} disabled={aiLoading || !aiIdea.trim()}>
                {aiLoading ? (
                  <><span className={styles.loadingDots} />&nbsp;Crafting your adventure…</>
                ) : (
                  <><IconSparkles /> Generate with AI</>
                )}
              </button>
              <button type="button" className={styles.aiSkipBtn} onClick={handleSkipAI} disabled={aiLoading}>
                Create manually
              </button>
            </div>
          </div>

          <div className={styles.aiStepHints}>
            <span className={styles.aiStepHint}>① Describe idea</span>
            <span className={styles.aiStepArrow}>→</span>
            <span className={styles.aiStepHint}>② Review &amp; edit</span>
            <span className={styles.aiStepArrow}>→</span>
            <span className={styles.aiStepHint}>③ Publish</span>
          </div>
        </div>
      </>
    );
  }

  /* ════════════════════════════════════════
     FORM PHASE
  ════════════════════════════════════════ */
  const isAiFilled = aiFilledFields.size > 0;

  return (
    <>
      {/* opaque: solid header (no hero below), stepProgress: orange progress bar */}
      <Header opaque stepProgress={stepProgress} />

      <div className={styles.createActivityPage}>

        {/* ── Left sidebar ── */}
        <aside className={styles.leftPanel}>
          <div className={styles.leftContent}>
            <div className={styles.leftBrand}>
              <div className={styles.brandIcon}><IconFlag /></div>
              <span className={styles.brandLabel}>New Adventure</span>
            </div>

            {isAiFilled && (
              <div className={styles.aiBadgePanel}>
                <IconSparkles />
                <span>AI-assisted draft</span>
                <button type="button" className={styles.aiBadgeEdit} onClick={() => setPhase("ai-entry")}>
                  Refine
                </button>
              </div>
            )}

            <nav className={styles.progressSteps} aria-label="Form progress">
              {progressSteps.map((s) => {
                const isActive = step === s.n;
                const isDone   = step > s.n;
                return (
                  <div key={s.n} className={[
                    styles.progressStep,
                    isActive ? styles.active    : "",
                    isDone   ? styles.completed : "",
                  ].join(" ")}>
                    <div className={styles.stepNumber}>
                      {isDone ? <IconCheck /> : <span>{s.emoji}</span>}
                    </div>
                    <div className={styles.stepInfo}>
                      <div className={styles.stepTitle}>{s.title}</div>
                      <div className={styles.stepDesc}>{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </nav>

            {(aiWarnings.length > 0 || aiMissingDetails.length > 0 || aiHighlights.length > 0) && (
              <div className={styles.infoCard} style={{ marginTop: 18 }}>
                <strong>AI notes</strong>
                {aiHighlights.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Highlights</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {aiHighlights.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {aiWarnings.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Warnings</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {aiWarnings.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {aiMissingDetails.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Missing details</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {aiMissingDetails.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {aiRationale && (
                  <div style={{ marginTop: 10, opacity: 0.9 }}>
                    <strong>Why this draft:</strong> {aiRationale}
                  </div>
                )}
              </div>
            )}

            <div className={styles.decorativeQuote}>
              <p>"Every great adventure starts with a single step"</p>
            </div>
          </div>
        </aside>

        {/* ── Right scrollable content ── */}
        <div className={styles.rightPanel}>
          <form ref={formRef} className={styles.activityForm} onSubmit={(e) => e.preventDefault()}>

            {/* ── Step 1: Basic Info ── */}
            {step === 1 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Tell us about your adventure</h2>
                  <p className={styles.stepSubheading}>Give it a great title and a vivid description</p>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="title">Activity Title</label>
                    {aiFilledFields.has("title") && (
                      <span className={styles.aiFilledBadge}>
                        <IconSparkles /> AI filled
                        <button type="button" className={styles.editAiField}
                          onClick={() => handleFieldEdit("title")}><IconPencil /> Edit</button>
                      </span>
                    )}
                  </div>
                  <input
                    id="title" type="text"
                    className={`${styles.formInput} ${aiFilledFields.has("title") ? styles.aiFilled : ""}`}
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); handleFieldEdit("title"); }}
                    placeholder="e.g., Mountain Hiking in Ain Draham"
                    maxLength={80}
                  />
                  <div className={styles.inputHint}>{title.length} / 80 characters</div>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="description">Description</label>
                    {aiFilledFields.has("description") && (
                      <span className={styles.aiFilledBadge}>
                        <IconSparkles /> AI filled
                        <button type="button" className={styles.editAiField}
                          onClick={() => handleFieldEdit("description")}><IconPencil /> Edit</button>
                      </span>
                    )}
                  </div>
                  <textarea
                    id="description"
                    className={`${styles.formTextarea} ${aiFilledFields.has("description") ? styles.aiFilled : ""}`}
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); handleFieldEdit("description"); }}
                    placeholder="Describe the route, what to bring, what's included…"
                    rows={5}
                  />
                  <div className={styles.inputHint}>Help adventurers know exactly what to expect</div>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label>Tags</label>
                    {aiFilledFields.has("tags") && (
                      <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                    )}
                  </div>
                  <TagInput tags={tags} onChange={(t) => { setTags(t); handleFieldEdit("tags"); }}
                    isAiFilled={aiFilledFields.has("tags")} />
                  <div className={styles.inputHint}>Up to 8 tags — press Enter or comma to add</div>
                </div>

                {safetyNotes.length > 0 && (
                  <div className={styles.infoCard}>
                    <strong>Suggested safety notes</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                      {safetyNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Details ── */}
            {step === 2 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Activity details</h2>
                  <p className={styles.stepSubheading}>Set difficulty and pricing</p>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label>Difficulty Level</label>
                    {aiFilledFields.has("difficulty") && (
                      <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                    )}
                  </div>
                  <div className={styles.difficultyGroup}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <button key={d.value} type="button"
                        className={[styles.difficultyCard, d.cardClass, difficulty === d.value ? styles.difficultySelected : ""].join(" ")}
                        onClick={() => { setDifficulty(d.value); handleFieldEdit("difficulty"); }}>
                        <span className={styles.difficultyEmoji}>{d.emoji}</span>
                        <span className={styles.difficultyLabel}>{d.label}</span>
                        <span className={styles.difficultySub}>{d.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="price">Price per Person (TND)</label>
                    {aiFilledFields.has("price") && (
                      <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                    )}
                  </div>
                  <div className={styles.inputWithIcon}>
                    <span className={styles.inputIcon}><IconCurrency /></span>
                    <input id="price" type="number" className={styles.formInput}
                      min={0} step={0.5} value={price}
                      onChange={(e) => { setPrice(Number(e.target.value)); handleFieldEdit("price"); }}
                      placeholder="0" />
                  </div>
                  <div className={styles.inputHint}>Set to 0 for free activities</div>
                </div>

                {(aiIncludedItems.length > 0 || aiWhatToBring.length > 0) && (
                  <div className={styles.infoCard}>
                    {aiIncludedItems.length > 0 && (
                      <>
                        <strong>Suggested inclusions</strong>
                        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                          {aiIncludedItems.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    )}
                    {aiWhatToBring.length > 0 && (
                      <>
                        <div style={{ marginTop: aiIncludedItems.length ? 12 : 8, fontWeight: 700 }}>Suggested what to bring</div>
                        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                          {aiWhatToBring.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Schedule ── */}
            {step === 3 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Schedule your session</h2>
                  <p className={styles.stepSubheading}>Set timing, group size, and optional notes</p>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="startAt">Start Date &amp; Time</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}><IconCalendar /></span>
                      <input id="startAt" type="datetime-local" className={styles.formInput}
                        value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="endAt">End Date &amp; Time</label>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}><IconCalendar /></span>
                      <input id="endAt" type="datetime-local" className={styles.formInput}
                        value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                    </div>
                    <div className={styles.inputHint}>Must be after start time</div>
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.labelRow}>
                      <label htmlFor="capacity">Group Capacity</label>
                      {aiFilledFields.has("capacity") && (
                        <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                      )}
                    </div>
                    <div className={styles.inputWithIcon}>
                      <span className={styles.inputIcon}><IconUsers /></span>
                      <input id="capacity" type="number" className={styles.formInput}
                        min={3} value={capacity}
                        onChange={(e) => { setCapacity(Number(e.target.value)); handleFieldEdit("capacity"); }} />
                    </div>
                    <div className={styles.inputHint}>Minimum 3 participants</div>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="meetingPoint">Meeting Point <span className={styles.optional}>(optional)</span></label>
                    {aiFilledFields.has("meetingPoint") && (
                      <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                    )}
                  </div>
                  <input id="meetingPoint" type="text" className={styles.formInput}
                    value={meetingPoint}
                    onChange={(e) => { setMeetingPoint(e.target.value); handleFieldEdit("meetingPoint"); }}
                    placeholder="e.g., Main parking, café entrance…" />
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label htmlFor="sessionNote">Session Notes <span className={styles.optional}>(optional)</span></label>
                    {aiFilledFields.has("sessionNote") && (
                      <span className={styles.aiFilledBadge}><IconSparkles /> AI suggested</span>
                    )}
                  </div>
                  <textarea id="sessionNote" className={styles.formTextarea}
                    value={sessionNote}
                    onChange={(e) => { setSessionNote(e.target.value); handleFieldEdit("sessionNote"); }}
                    placeholder="What to bring, special instructions, tips…" rows={4} />
                </div>
              </div>
            )}

            {/* ── Step 4: Categories ── */}
            {step === 4 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Choose categories</h2>
                  <p className={styles.stepSubheading}>Select at least one category for your activity</p>
                </div>

                {aiFilledFields.has("categories") && (
                  <div className={styles.infoCard} style={{ marginBottom: 14 }}>
                    <strong>AI suggested categories</strong>
                  </div>
                )}

                <div className={styles.categoryGrid}>
                  {categories.map((c) => {
                    const selected = categoryIds.includes(c.id);
                    const icon     = c.iconUrl ?? null;
                    return (
                      <button key={c.id} type="button"
                        className={`${styles.categoryCard} ${selected ? styles.selected : ""}`}
                        onClick={() => toggleCategory(c.id)}
                        aria-pressed={selected}>
                        <div className={styles.categoryIcon}>
                          {icon && isImageUrl(icon)
                            ? <img src={icon} alt={c.name ?? "Category"} />
                            : <span>{icon ?? "📦"}</span>}
                        </div>
                        <div className={styles.categoryTitle}>{c.name}</div>
                        {c.description && <div className={styles.categoryDesc}>{c.description}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 5: Location ── */}
            {step === 5 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Where's the adventure?</h2>
                  <p className={styles.stepSubheading}>Search or click the map to set the meeting point</p>
                </div>
                <div className={styles.locationWrapper}>
                  <LocationPicker value={location} onChange={setLocation} label="Meeting Point" />
                </div>
                {location && (
                  <div className={styles.locationPreview}>
                    <div className={styles.previewHeader}><IconCheck /> Location confirmed</div>
                    <div className={styles.previewName}>{location.displayName}</div>
                    <div className={styles.previewCoords}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 6: Photos ── */}
            {step === 6 && (
              <div className={styles.formStep}>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepHeading}>Upload photos</h2>
                  <p className={styles.stepSubheading}>Add a cover photo and gallery images</p>
                </div>
                {!createdTemplate?.id ? (
                  <div className={styles.infoCard}>Something went wrong — please go back and try again.</div>
                ) : (
                  <>
                    <label className={styles.uploadZone}>
                      <input type="file" accept="image/jpeg,image/png,image/webp"
                        multiple className={styles.uploadInput} disabled={uploading}
                        onChange={(e) => onUploadFiles(e.target.files)} />
                      <div className={styles.uploadContent}>
                        <span className={styles.uploadIcon}>📷</span>
                        <span className={styles.uploadText}>
                          {uploading ? "Uploading…" : "Click or drag photos here"}
                        </span>
                        <span className={styles.uploadHint}>JPG / PNG / WEBP — max 5 MB each</span>
                      </div>
                    </label>

                    {images.length > 0 && (
                      <div className={styles.imageGrid}>
                        {images.slice().sort((a, b) => a.order - b.order).map((img) => (
                          <div key={img.publicId ?? img.url} className={styles.imageThumb}>
                            <img src={img.url} alt={img.alt ?? "Activity image"} />
                            {img.cover && <span className={styles.coverBadge}>Cover</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={styles.infoCard} style={{ marginTop: 14 }}>
                      💡 The first photo you upload becomes the cover automatically.
                    </div>
                  </>
                )}
              </div>
            )}

            {status && (
              <div className={`${styles.statusPill} ${status.includes("✅") ? styles.success : styles.error}`}>
                {status}
              </div>
            )}

            {/* ── Navigation ── */}
            <div className={styles.formNavigation}>
              <button type="button" className={styles.navBtnSecondary} onClick={prevStep}
                disabled={submitting || uploading || aiLoading}>
                <IconArrowLeft /> Back
              </button>

              <div className={styles.navSpacer} />

              {step >= 1 && step <= 4 && (
                <button type="button" className={styles.navBtnPrimary} onClick={nextStep}
                  disabled={
                    submitting || uploading || aiLoading ||
                    (step === 1 && !step1Valid) || (step === 2 && !step2Valid) ||
                    (step === 3 && !step3Valid) || (step === 4 && !step4Valid)
                  }>
                  Continue <IconArrowRight />
                </button>
              )}
              {step === 5 && (
                <button type="button" className={styles.navBtnPrimary} onClick={handleStep5Next}
                  disabled={!step5Valid || submitting || aiLoading}>
                  {submitting ? "Creating…" : <>Continue <IconArrowRight /></>}
                </button>
              )}
              {step === 6 && (
                <button type="button" className={styles.navBtnPublish} onClick={onFinish}
                  disabled={uploading || submitting || !createdTemplate?.id || !step6Valid}>
                  {submitting ? "Publishing…" : <><IconFlag /> Publish Adventure</>}
                </button>
              )}
            </div>

            {createdTemplate?.id && (
              <div className={styles.resetRow}>
                <button type="button" className={styles.resetBtn} onClick={resetAll}
                  disabled={submitting || uploading}>Start over</button>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}