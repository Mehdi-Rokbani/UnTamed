// src/api/activity.api.ts
import { http } from "./http";
import type {
  ActivityCreatePayload,
  ActivityResponse,
  ActivityStatus,
  ActivityUpdatePayload,
} from "../types/activity";

/**
 * PUBLIC
 */
export async function listPublishedActivities() {
  const { data } = await http.get<ActivityResponse[]>("/api/activities");
  return data;
}

export async function getActivityById(id: string) {
  const { data } = await http.get<ActivityResponse>(`/api/activities/${id}`);
  return data;
}

/**
 * GUIDE (cookie-auth)
 */
export async function listMyActivities() {
  const { data } = await http.get<ActivityResponse[]>("/api/activities/mine", {
    withCredentials: true,
  });
  return data;
}

export async function createActivity(body: ActivityCreatePayload) {
  const { data } = await http.post<ActivityResponse>("/api/activities", body, {
    withCredentials: true,
  });
  return data;
}

export async function updateActivity(id: string, body: ActivityUpdatePayload) {
  const { data } = await http.patch<ActivityResponse>(`/api/activities/${id}`, body, {
    withCredentials: true,
  });
  return data;
}

// old compatibility endpoint
export async function setActivityPublished(id: string, published: boolean) {
  const { data } = await http.patch<ActivityResponse>(
    `/api/activities/${id}/published`,
    null,
    { params: { published }, withCredentials: true }
  );
  return data;
}

// preferred endpoint
export async function setActivityStatus(id: string, status: ActivityStatus) {
  const { data } = await http.patch<ActivityResponse>(
    `/api/activities/${id}/status`,
    null,
    { params: { status }, withCredentials: true }
  );
  return data;
}

/**
 * IMAGES (Cloudinary via backend)
 * Backend routes you added:
 * - POST   /api/activities/{id}/images  (multipart)
 * - PATCH  /api/activities/{id}/images/cover/{publicId}   (path)
 * - DELETE /api/activities/{id}/images/{publicId}         (path)
 *
 * WARNING: Cloudinary publicId usually contains "/" if you upload into folders (activities/{id}/...).
 * That breaks path variables unless you URL-encode OR change backend to query-param style.
 *
 * Here: I’m giving you BOTH.
 *
 * 1) If you KEEP path-variable backend, use these functions and they will URL-encode publicId.
 * 2) If you SWITCH backend to query-param style, use the query versions below.
 */

// -------------- Upload --------------
export async function addActivityImage(
  activityId: string,
  file: File,
  opts?: { cover?: boolean; alt?: string }
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("cover", String(opts?.cover ?? false));
  if (opts?.alt) fd.append("alt", opts.alt);

  const { data } = await http.post<ActivityResponse>(
    `/api/activities/${activityId}/images`,
    fd,
    { withCredentials: true }
  );
  return data;
}

// -------------- Path-variable versions (encode publicId) --------------
function encodePublicId(publicId: string) {
  // encodes "/" safely for path segments
  return encodeURIComponent(publicId);
}

export async function setActivityCover_path(activityId: string, publicId: string) {
  const pid = encodePublicId(publicId);
  const { data } = await http.patch<ActivityResponse>(
    `/api/activities/${activityId}/images/cover/${pid}`,
    null,
    { withCredentials: true }
  );
  return data;
}

export async function deleteActivityImage_path(activityId: string, publicId: string) {
  const pid = encodePublicId(publicId);
  const { data } = await http.delete<ActivityResponse>(
    `/api/activities/${activityId}/images/${pid}`,
    { withCredentials: true }
  );
  return data;
}

// -------------- Query-param versions (recommended if you change backend) --------------
export async function setActivityCover_query(activityId: string, publicId: string) {
  const { data } = await http.patch<ActivityResponse>(
    `/api/activities/${activityId}/images/cover`,
    null,
    { params: { publicId }, withCredentials: true }
  );
  return data;
}

export async function deleteActivityImage_query(activityId: string, publicId: string) {
  const { data } = await http.delete<ActivityResponse>(
    `/api/activities/${activityId}/images`,
    { params: { publicId }, withCredentials: true }
  );
  return data;
}

// Optional reorder (only if you kept the reorder endpoint)
export async function reorderActivityImages(activityId: string, publicIdsInOrder: string[]) {
  const { data } = await http.patch<ActivityResponse>(
    `/api/activities/${activityId}/images/reorder`,
    publicIdsInOrder,
    { withCredentials: true }
  );
  return data;
}
