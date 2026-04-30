import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type {
  ActivityTemplateResponse,
  Difficulty,
  ActivityImage,
  AddressPickDto,
} from "../types/activity";

import {
  getTemplateById,
  updateTemplate,
  addTemplateImage,
  deleteTemplateImage,
  setTemplateCoverImage,
  reorderTemplateImages,
} from "../api/activity.api";

import { listCategories } from "../api/category.api";
import type { Category } from "../types/category";

import { listTags } from "../api/tag.api";
import type { Tag } from "../types/tag";

import LocationPicker from "../components/LocationPicker";
import type { AddressResponse } from "../types/geo";
import styles from "../style/editActivity.module.css";

type Tab = "DETAILS" | "PHOTOS";

const TAG_GROUP_ORDER = ["ENVIRONMENT", "VIBE", "EFFORT", "REQUIREMENT", "BUDGET", "AI_SUGGESTED"];

const TAG_GROUP_LABELS: Record<string, string> = {
  ENVIRONMENT: "Environment",
  VIBE: "Vibe",
  EFFORT: "Effort",
  REQUIREMENT: "Requirements",
  BUDGET: "Budget",
  AI_SUGGESTED: "AI generated",
};

const COMMON_ACTIVITY_TAG_SLUGS = new Set([
  "hiking",
  "camping",
  "diving",
  "quad-biking",
  "running",
  "marathon",
  "trail-running",
  "kayaking",
  "cycling",
  "caving",
  "snorkeling",
  "race",
  "guided-run",
]);

function niceError(msg: string) {
  const lower = msg.toLowerCase();

  if (lower.includes("location")) return "Add a location before publishing.";
  if (lower.includes("coordinates")) return "Pick a location with map coordinates.";
  if (lower.includes("image")) return "Upload at least one photo.";
  if (lower.includes("category")) return "Select at least one category.";
  if (lower.includes("price")) return "Price must be greater than or equal to 0.";

  return msg;
}

function displayFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueCleanList(values: unknown, max = 50): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  ).slice(0, max);
}

function isActivityTag(slug: string, allTags: Tag[]) {
  const found = allTags.find((tag) => tag.slug === slug);
  return found?.type === "ACTIVITY" || COMMON_ACTIVITY_TAG_SLUGS.has(slug);
}

function buildAddressPick(loc: AddressResponse): AddressPickDto {
  return {
    provider: loc.provider,
    providerPlaceId: loc.providerPlaceId,
    displayName: loc.displayName,
    governorate: loc.governorate ?? null,
    delegation: loc.delegation ?? null,
    locality: loc.locality ?? null,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
  };
}

function normalizePrice(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

export default function EditActivityPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [tab, setTab] = useState<Tab>("DETAILS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [template, setTemplate] = useState<ActivityTemplateResponse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [price, setPrice] = useState<number>(0);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [location, setLocation] = useState<AddressResponse | null>(null);

  const [descriptorTags, setDescriptorTags] = useState<string[]>([]);
  const [preservedActivityTags, setPreservedActivityTags] = useState<string[]>([]);
  const [safetyNotesText, setSafetyNotesText] = useState("");

  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        const [cats, tags] = await Promise.all([
          listCategories({ activeOnly: true }),
          listTags(),
        ]);

        if (cancelled) return;

        setCategories(cats);

        const usableTags = tags
          .filter((tag) => tag.active && tag.status !== "REJECTED")
          .sort((a, b) => {
            const orderA = a.sortOrder ?? 999;
            const orderB = b.sortOrder ?? 999;

            if (a.type !== b.type) {
              return TAG_GROUP_ORDER.indexOf(a.type) - TAG_GROUP_ORDER.indexOf(b.type);
            }

            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
          });

        setAvailableTags(usableTags);
      } catch {
        if (!cancelled) {
          setCategories([]);
          setAvailableTags([]);
        }
      }
    }

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      if (!id) return;

      setLoading(true);
      setErr(null);
      setOk(null);

      try {
        const current = await getTemplateById(id);
        if (cancelled) return;

        setTemplate(current);
        setTitle(current.title ?? "");
        setDescription(current.description ?? "");
        setDifficulty((current.difficulty ?? "EASY") as Difficulty);
        setPrice(Number(current.price ?? 0));
        setCategoryIds(current.categoryIds ?? []);

        const currentTags = uniqueCleanList(current.tags ?? []);
        const activityTags = currentTags.filter((slug) => isActivityTag(slug, availableTags));
        const descriptors = currentTags.filter((slug) => !isActivityTag(slug, availableTags));

        setPreservedActivityTags(activityTags);
        setDescriptorTags(descriptors);
        setSafetyNotesText(uniqueCleanList(current.safetyNotes ?? []).join("\n"));

        // Your current guide template response only returns addressId.
        // LocationPicker cannot prefill until backend returns the full address object.
        setLocation(null);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load template");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [id, availableTags]);

  const imagesSorted = useMemo(() => {
    const imgs = template?.images ?? [];
    return [...imgs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const descriptorVisibleTags = useMemo(() => {
    return availableTags.filter((tag) => tag.type !== "ACTIVITY");
  }, [availableTags]);

  const groupedTags = useMemo(() => {
    const allDescriptorTags = [...descriptorVisibleTags];

    for (const slug of descriptorTags) {
      const exists = allDescriptorTags.some((tag) => tag.slug === slug);
      if (!exists) {
        allDescriptorTags.push({
          id: slug,
          slug,
          name: displayFromSlug(slug),
          type: "AI_SUGGESTED",
          status: "AI_SUGGESTED",
          synonyms: [],
          active: true,
          aiSuggested: true,
          usageCount: 0,
          sortOrder: null,
        });
      }
    }

    return allDescriptorTags.reduce<Record<string, Tag[]>>((acc, tag) => {
      acc[tag.type] ??= [];
      acc[tag.type].push(tag);
      return acc;
    }, {});
  }, [descriptorTags, descriptorVisibleTags]);

  const selectedCategoryNames = useMemo(() => {
    return categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => category.name);
  }, [categories, categoryIds]);

  function toggleCategory(categoryId: string) {
    setCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function toggleDescriptorTag(slug: string) {
    setDescriptorTags((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((tag) => tag !== slug);
      }

      if (prev.length >= 12) {
        return prev;
      }

      return [...prev, slug];
    });
  }

  function parseSafetyNotes() {
    return safetyNotesText
      .split("\n")
      .map((note) => note.trim())
      .filter(Boolean);
  }

  function validateBeforeSave() {
    if (!title.trim()) return "Title is required.";
    if (!description.trim()) return "Description is required.";
    if (price < 0) return "Price must be greater than or equal to 0.";
    if (categoryIds.length === 0) return "Select at least one category.";
    return null;
  }

  async function onSave() {
    if (!id || !template) return;

    const validationError = validateBeforeSave();
    if (validationError) {
      setErr(validationError);
      setOk(null);
      return;
    }

    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        difficulty,
        price,
        categoryIds,
        tags: Array.from(new Set([...preservedActivityTags, ...descriptorTags])),
        safetyNotes: parseSafetyNotes(),
        address: location ? buildAddressPick(location) : undefined,
      };

      const updated = await updateTemplate(id, payload);
      setTemplate(updated);

      const updatedTags = uniqueCleanList(updated.tags ?? []);
      setPreservedActivityTags(updatedTags.filter((slug) => isActivityTag(slug, availableTags)));
      setDescriptorTags(updatedTags.filter((slug) => !isActivityTag(slug, availableTags)));
      setSafetyNotesText(uniqueCleanList(updated.safetyNotes ?? []).join("\n"));

      setOk("Template saved.");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(files: FileList | null) {
    if (!id || !template || !files || files.length === 0) return;

    setUploading(true);
    setErr(null);
    setOk(null);

    try {
      let latest = template;

      for (let i = 0; i < files.length; i++) {
        latest = await addTemplateImage(id, files[i], {
          cover: i === 0 && (latest.images?.length ?? 0) === 0,
          alt: title.trim() || "Activity image",
        });
        setTemplate(latest);
      }

      setOk("Photos uploaded.");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function onSetCover(publicId?: string | null) {
    if (!id || !publicId) return;

    setErr(null);
    setOk(null);

    try {
      const updated = await setTemplateCoverImage(id, publicId);
      setTemplate(updated);
      setOk("Cover photo updated.");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Cover update failed"));
    }
  }

  async function onDelete(publicId?: string | null) {
    if (!id || !publicId) return;

    setErr(null);
    setOk(null);

    try {
      const updated = await deleteTemplateImage(id, publicId);
      setTemplate(updated);
      setOk("Photo deleted.");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Delete failed"));
    }
  }

  async function commitReorder(nextImages: ActivityImage[]) {
    if (!id) return;

    const ids = nextImages.map((img) => img.publicId).filter(Boolean) as string[];
    if (ids.length === 0) return;

    setErr(null);
    setOk(null);

    try {
      const updated = await reorderTemplateImages(id, ids);
      setTemplate(updated);
      setOk("Photos reordered.");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Reorder failed"));
    }
  }

  function onDragStart(img: ActivityImage) {
    setDragId(img.publicId ?? null);
  }

  function onDrop(target: ActivityImage) {
    if (!dragId || !template) return;

    const list = imagesSorted;
    const fromIdx = list.findIndex((img) => img.publicId === dragId);
    const toIdx = list.findIndex((img) => img.publicId === target.publicId);

    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) {
      setDragId(null);
      return;
    }

    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    const normalized = next.map((img, idx) => ({ ...img, order: idx }));

    setTemplate((prev) => (prev ? { ...prev, images: normalized } : prev));
    commitReorder(normalized);
    setDragId(null);
  }

  if (loading) {
    return (
      <div className={styles.ea}>
        <div className={styles.centerState}>Loading template…</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className={styles.ea}>
        <div className={styles.centerState}>Template not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.ea}>
      <header className={styles.hero}>
        <div>
          <div className={styles.kicker}>Edit activity template</div>
          <h1>{title || template.title}</h1>
          <p>
            Update the reusable activity page. Publishing and dates are managed from sessions.
          </p>

          <div className={styles.summaryChips}>
            <span>{difficulty}</span>
            <span>{price === 0 ? "Free" : `${price} TND`}</span>
            <span>{selectedCategoryNames.length || categoryIds.length} categories</span>
            <span>{imagesSorted.length} photos</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button className={styles.secondaryBtn} type="button" onClick={() => nav("/guide/activities")}>
            ← Back
          </button>
          <button className={styles.primaryBtn} type="button" onClick={onSave} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      {(err || ok) && (
        <div className={`${styles.banner} ${err ? styles.bannerError : styles.bannerSuccess}`}>
          {err ? `⚠️ ${err}` : `✅ ${ok}`}
        </div>
      )}

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "DETAILS" ? styles.activeTab : ""}`}
          onClick={() => setTab("DETAILS")}
        >
          Details
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "PHOTOS" ? styles.activeTab : ""}`}
          onClick={() => setTab("PHOTOS")}
        >
          Photos
        </button>
      </div>

      {tab === "DETAILS" ? (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Activity information</h2>
              <p>Keep the public page clear, accurate, and aligned with your new tag system.</p>
            </div>
            <span className={styles.notice}>Sessions control availability</span>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className={styles.field}>
              <span>Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                <option value="EASY">🟢 Easy</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="HARD">🔴 Hard</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Price (TND)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(normalizePrice(e.target.value))}
              />
            </label>

            <label className={`${styles.field} ${styles.full}`}>
              <span>Description</span>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className={`${styles.field} ${styles.full}`}>
              <span>Categories</span>
              <p className={styles.helpText}>Categories are the activity type: hiking, running, camping, diving…</p>

              <div className={styles.categoryGrid}>
                {categories.map((category) => {
                  const selected = categoryIds.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`${styles.categoryChip} ${selected ? styles.selectedChip : ""}`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      {selected && <span>✓</span>}
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`${styles.field} ${styles.full}`}>
              <span>Activity descriptors</span>
              <p className={styles.helpText}>
                Tags describe environment, vibe, effort, budget, and AI-generated details.
                Activity type belongs in categories.
              </p>

              {preservedActivityTags.length > 0 && (
                <div className={styles.preservedBox}>
                  <strong>Preserved activity tags</strong>
                  <p>
                    These came from older AI-generated tags and are preserved when saving:
                    {" "}
                    {preservedActivityTags.map(displayFromSlug).join(", ")}
                  </p>
                </div>
              )}

              <div className={styles.tagGroups}>
                {TAG_GROUP_ORDER.filter((group) => groupedTags[group]?.length).map((group) => (
                  <div key={group} className={styles.tagGroup}>
                    <div className={styles.tagGroupTitle}>{TAG_GROUP_LABELS[group] ?? group}</div>

                    <div className={styles.tagRow}>
                      {groupedTags[group].map((tag) => {
                        const selected = descriptorTags.includes(tag.slug);
                        const ai = tag.status === "AI_SUGGESTED" || tag.aiSuggested || tag.type === "AI_SUGGESTED";

                        return (
                          <button
                            key={tag.slug}
                            type="button"
                            className={`${styles.tagChip} ${selected ? styles.selectedTag : ""} ${ai ? styles.aiTag : ""}`}
                            onClick={() => toggleDescriptorTag(tag.slug)}
                          >
                            {selected && <span>✓</span>}
                            {tag.name}
                            {ai && <span className={styles.spark}>✦</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className={`${styles.field} ${styles.full}`}>
              <span>Safety notes</span>
              <p className={styles.helpText}>One note per line. These are shown to help participants prepare safely.</p>
              <textarea
                rows={5}
                value={safetyNotesText}
                onChange={(e) => setSafetyNotesText(e.target.value)}
                placeholder="Bring enough water&#10;Wear appropriate shoes&#10;Weather may change quickly"
              />
            </label>

            <div className={`${styles.field} ${styles.full}`}>
              <span>Location</span>
              <LocationPicker value={location} onChange={setLocation} label="Meeting point" />
              <p className={styles.helpText}>
                Current backend response only gives addressId, so the picker may not prefill until the full address is returned.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Photos</h2>
              <p>Drag photos to reorder. Choose one cover image for the activity page.</p>
            </div>

            <label className={styles.uploadBtn}>
              {uploading ? "Uploading…" : "Upload photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(e) => onUpload(e.target.files)}
              />
            </label>
          </div>

          {imagesSorted.length > 0 ? (
            <div className={styles.photoGrid}>
              {imagesSorted.map((img) => (
                <article
                  key={img.publicId ?? img.url}
                  className={`${styles.photoCard} ${dragId === img.publicId ? styles.dragging : ""}`}
                  draggable
                  onDragStart={() => onDragStart(img)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(img)}
                >
                  <img src={img.url} alt={img.alt ?? "Activity photo"} />

                  <div className={styles.photoOverlay}>
                    {img.cover && <span className={styles.coverBadge}>Cover</span>}

                    <div className={styles.photoActions}>
                      <button type="button" onClick={() => onSetCover(img.publicId)} disabled={img.cover}>
                        Set cover
                      </button>
                      <button type="button" onClick={() => onDelete(img.publicId)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyPhotos}>
              <div>🖼️</div>
              <strong>No photos yet</strong>
              <p>Upload at least one high-quality image before publishing sessions.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
