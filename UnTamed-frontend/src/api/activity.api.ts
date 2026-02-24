import { http } from "./http";
import type {
  ActivityStatus,
  ActivityTemplateCreatePayload,
  ActivityTemplateUpdatePayload,
  ActivityTemplateResponse,
  ActivitySessionCreatePayload,
  ActivitySessionUpdatePayload,
  ActivitySessionResponse,
  PublicTemplateCard,
  PublicSession,
} from "../types/activity";

/** ---------------------------
 *  PUBLIC (GetYourGuide-style)
 *  ---------------------------
 */

export async function listPublicTemplates() {
  const { data } = await http.get<PublicTemplateCard[]>("/api/templates/public");
  return data;
}

export async function getPublicTemplateById(id: string) {
  const { data } = await http.get<PublicTemplateCard>(`/api/templates/public/${id}`);
  return data;
}

export async function listPublicTemplateSessions(id: string) {
  const { data } = await http.get<PublicSession[]>(`/api/templates/public/${id}/sessions`);
  return data;
}


/** ---------------------------
 *  SESSIONS (public)
 *  ---------------------------
 */

export async function listPublishedSessions() {
  const { data } = await http.get<ActivitySessionResponse[]>("/api/sessions");
  return data;
}

export async function getSessionById(id: string) {
  const { data } = await http.get<ActivitySessionResponse>(`/api/sessions/${id}`);
  return data;
}

/** ---------------------------
 *  GUIDE: TEMPLATES
 *  ---------------------------
 */

export async function listMyTemplates() {
  const { data } = await http.get<ActivityTemplateResponse[]>("/api/templates/mine", {
    withCredentials: true,
  });
  return data;
}

export async function getTemplateById(id: string) {
  const { data } = await http.get<ActivityTemplateResponse>(`/api/templates/${id}`, {
    withCredentials: true,
  });
  return data;
}

export async function createTemplate(body: ActivityTemplateCreatePayload) {
  const { data } = await http.post<ActivityTemplateResponse>("/api/templates", body, {
    withCredentials: true,
  });
  return data;
}

export async function updateTemplate(id: string, body: ActivityTemplateUpdatePayload) {
  const { data } = await http.patch<ActivityTemplateResponse>(`/api/templates/${id}`, body, {
    withCredentials: true,
  });
  return data;
}

export async function deleteTemplate(id: string) {
  await http.delete(`/api/templates/${id}`, { withCredentials: true });
}

/** ---------------------------
 *  GUIDE: TEMPLATE IMAGES
 *  ---------------------------
 */

export async function addTemplateImage(
  templateId: string,
  file: File,
  opts?: { cover?: boolean; alt?: string }
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("cover", String(opts?.cover ?? false));
  if (opts?.alt) fd.append("alt", opts.alt);

  const { data } = await http.post<ActivityTemplateResponse>(
    `/api/templates/${templateId}/images`,
    fd,
    { withCredentials: true }
  );
  return data;
}

export async function setTemplateCoverImage(templateId: string, publicId: string) {
  const { data } = await http.patch<ActivityTemplateResponse>(
    `/api/templates/${templateId}/images/cover`,
    null,
    { params: { publicId }, withCredentials: true }
  );
  return data;
}

export async function deleteTemplateImage(templateId: string, publicId: string) {
  const { data } = await http.delete<ActivityTemplateResponse>(
    `/api/templates/${templateId}/images`,
    { params: { publicId }, withCredentials: true }
  );
  return data;
}

export async function reorderTemplateImages(templateId: string, publicIdsInOrder: string[]) {
  const { data } = await http.patch<ActivityTemplateResponse>(
    `/api/templates/${templateId}/images/reorder`,
    publicIdsInOrder,
    { withCredentials: true }
  );
  return data;
}

/** ---------------------------
 *  GUIDE: SESSIONS
 *  ---------------------------
 */

export async function listMySessions() {
  const { data } = await http.get<ActivitySessionResponse[]>("/api/sessions/mine", {
    withCredentials: true,
  });
  return data;
}

// create a session under a template
export async function createSession(templateId: string, body: ActivitySessionCreatePayload) {
  const { data } = await http.post<ActivitySessionResponse>(
    `/api/sessions/template/${templateId}`,
    body,
    { withCredentials: true }
  );
  return data;
}

export async function updateSession(id: string, body: ActivitySessionUpdatePayload) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}`,
    body,
    { withCredentials: true }
  );
  return data;
}

// preferred
export async function setSessionStatus(id: string, status: ActivityStatus) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}/status`,
    null,
    { params: { status }, withCredentials: true }
  );
  return data;
}

// optional compatibility toggle
export async function setSessionPublished(id: string, published: boolean) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}/published`,
    null,
    { params: { published }, withCredentials: true }
  );
  return data;

}

