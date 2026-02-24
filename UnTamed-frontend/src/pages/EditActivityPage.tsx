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

import LocationPicker from "../components/LocationPicker";
import type { AddressResponse } from "../types/geo";
import styles from "../style/editActivity.module.css";

type Tab = "DETAILS" | "PHOTOS";

function niceError(msg: string) {
  if (msg.includes("location")) return "Add a location before publishing.";
  if (msg.includes("coordinates")) return "Pick a location with map coordinates.";
  if (msg.includes("image")) return "Upload at least one photo.";
  if (msg.includes("category")) return "Select at least one category.";
  return msg;
}

export default function EditActivityPage() {
  const { id } = useParams<{ id: string }>(); // templateId now
  const nav = useNavigate();

  const [tab, setTab] = useState<Tab>("DETAILS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [template, setTemplate] = useState<ActivityTemplateResponse | null>(null);

  // editable fields (TEMPLATE fields only)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [price, setPrice] = useState<number>(0);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [location, setLocation] = useState<AddressResponse | null>(null);
  const [tagsText, setTagsText] = useState<string>("");

  useEffect(() => {
    listCategories({ activeOnly: true })
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setErr(null);
      setOk(null);

      try {
        const t = await getTemplateById(id);
        if (dead) return;

        setTemplate(t);

        setTitle(t.title ?? "");
        setDescription(t.description ?? "");
        setDifficulty((t.difficulty ?? "EASY") as Difficulty);
        setPrice(Number(t.price ?? 0));
        setCategoryIds(t.categoryIds ?? []);
        // NOTE: guide template response currently does not include address object,
        // so keep location picker empty unless you return it from backend.
        setLocation(null);
        setTagsText((t.tags ?? []).join(", "));
      } catch (e) {
        if (dead) return;
        setErr(e instanceof Error ? e.message : "Failed to load template");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [id]);

  function toggleCategory(cid: string) {
    setCategoryIds((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));
  }

  const imagesSorted = useMemo(() => {
    const imgs = template?.images ?? [];
    return [...imgs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

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

  function parseTags(text: string): string[] {
    return text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function onSave() {
    if (!id || !template) return;

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
        tags: parseTags(tagsText),
        // send address only if you allow editing it via template update
        address: location ? buildAddressPick(location) : undefined,
      };

      const updated = await updateTemplate(id, payload);
      setTemplate(updated);
      setOk("Saved ✅");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(files: FileList | null) {
    if (!id || !template) return;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErr(null);
    setOk(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const updated = await addTemplateImage(id, file, {
          cover: i === 0 && (template.images?.length ?? 0) === 0,
          alt: title.trim() || "Template image",
        });
        setTemplate(updated);
      }
      setOk("Photos uploaded ✅");
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
      setOk("Cover updated ✅");
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
      setOk("Photo deleted ✅");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Delete failed"));
    }
  }

  // -------- Drag & drop reorder --------
  const [dragId, setDragId] = useState<string | null>(null);

  async function commitReorder(nextImages: ActivityImage[]) {
    if (!id) return;
    const ids = nextImages.map((x) => x.publicId).filter(Boolean) as string[];
    if (ids.length === 0) return;

    setErr(null);
    setOk(null);
    try {
      const updated = await reorderTemplateImages(id, ids);
      setTemplate(updated);
      setOk("Reordered ✅");
    } catch (e) {
      setErr(niceError(e instanceof Error ? e.message : "Reorder failed"));
    }
  }

  function onDragStart(img: ActivityImage) {
    setDragId(img.publicId ?? null);
  }

  function onDrop(target: ActivityImage) {
    if (!dragId) return;
    if (!template) return;

    const list = imagesSorted;
    const fromIdx = list.findIndex((x) => x.publicId === dragId);
    const toIdx = list.findIndex((x) => x.publicId === target.publicId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    const normalized = next.map((x, idx) => ({ ...x, order: idx }));
    setTemplate((prev) => (prev ? { ...prev, images: normalized } : prev));
    commitReorder(normalized);
    setDragId(null);
  }

  if (loading) return <div className={styles.ea}>Loading…</div>;
  if (!template) return <div className={styles.ea}>Not found.</div>;

  return (
    <div className={styles.ea}>
      <div className={styles.eaTop}>
        <div>
          <div className={styles.eaKicker}>Edit Template</div>
          <h1 className={styles.eaTitle}>{template.title}</h1>
          <div className={styles.eaReadonly} style={{ opacity: 0.85 }}>
            Publishing is per session (dates) — edit sessions to publish/unpublish.
          </div>
        </div>

        <div className={styles.eaActions}>
          <button className={`${styles.eaBtn} ${styles.eaBtnGhost}`} type="button" onClick={() => nav("/guide/activities")}>
            ← Back
          </button>

          <button className={`${styles.eaBtn} ${styles.eaBtnPrimary}`} type="button" onClick={onSave} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {(err || ok) && (
        <div className={`ea-banner ${err ? "ea-banner--err" : "ea-banner--ok"}`}>
          {err ? `⚠️ ${err}` : `✅ ${ok}`}
        </div>
      )}

      <div className={styles.eaTabs}>
        <button className={`${styles.eaTab} ${tab === "DETAILS" ? styles.eaTabActive : ""}`} onClick={() => setTab("DETAILS")} type="button">
          Details
        </button>
        <button className={`${styles.eaTab} ${tab === "PHOTOS" ? styles.eaTabActive : ""}`} onClick={() => setTab("PHOTOS")} type="button">
          Photos
        </button>
      </div>

      {tab === "DETAILS" ? (
        <div className={styles.eaCard}>
          <div className={styles.eaGrid}>
            <div className={styles.eaField}>
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className={styles.eaField}>
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                <option value="EASY">🟢 EASY</option>
                <option value="MEDIUM">🟡 MEDIUM</option>
                <option value="HARD">🔴 HARD</option>
              </select>
            </div>

            <div className={styles.eaField}>
              <label>Price (TND)</label>
              <input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>

            <div className={`${styles.eaField} ${styles.eaFieldFull}`}>
              <label>Description</label>
              <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className={`${styles.eaField} ${styles.eaFieldFull}`}>
              <label>Tags (comma separated)</label>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="camping, sunrise, family" />
            </div>

            <div className={`${styles.eaField} ${styles.eaFieldFull}`}>
              <label>Categories (pick at least one)</label>
              <div className={styles.eaCats}>
                {categories.map((c) => {
                  const selected = categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles.eaCat} ${selected ? styles.eaCatSelected : ""}`}
                      onClick={() => toggleCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`${styles.eaField} ${styles.eaFieldFull}`}>
              <label>Location</label>
              <LocationPicker value={location} onChange={setLocation} label="Meeting Point" />
              <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                If location doesn’t prefill: return address in template response (optional).
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.eaCard}>
          <div className={styles.eaPhotoTop}>
            <div>
              <div className={styles.eaPhotoTitle}>Manage photos</div>
              <div className={styles.eaPhotoSub}>Drag & drop to reorder. Click a photo to set cover.</div>
            </div>

            <div className={styles.eaPhotoActions}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={(e) => onUpload(e.target.files)}
              />
            </div>
          </div>

          <div className={styles.eaPhotoGrid}>
            {imagesSorted.map((img) => (
              <div
                key={img.publicId ?? img.url}
                className={`${styles.eaPhoto} ${dragId && dragId === img.publicId ? styles.eaPhotoDragging : ""}`}
                draggable
                onDragStart={() => onDragStart(img)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(img)}
              >
                <img src={img.url} alt={img.alt ?? "Template photo"} />
                <div className={styles.eaPhotoOverlay}>
                  {img.cover && <span className={styles.eaPill}>Cover</span>}
                  <div className={styles.eaPhotoBtns}>
                    <button type="button" onClick={() => onSetCover(img.publicId)}>
                      Set cover
                    </button>
                    <button type="button" onClick={() => onDelete(img.publicId)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {imagesSorted.length === 0 && (
              <div className={styles.eaPhotoEmpty}>
                <div className={styles.eaPhotoEmptyIcon}>🖼️</div>
                <div>No photos yet — upload at least one.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}