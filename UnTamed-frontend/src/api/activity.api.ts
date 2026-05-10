import { http } from "./http";

import type {
  ActivityStatus,
  ActivityTemplateCreatePayload,
  ActivityTemplateUpdatePayload,
  ActivityTemplateResponse,
  ActivityTemplateDeleteResponse,
  ActivityTemplateArchiveResponse,
  ActivitySessionCreatePayload,
  ActivitySessionUpdatePayload,
  ActivitySessionResponse,
  ActivitySessionDeleteResponse,
  GuideSessionDetailsResponse,
  GuideTemplateSessionsDashboardResponse,
  PublicTemplateCard,
  PublicSession,
  Difficulty,
} from "../types/activity";
import type { PaginatedResponse } from "../types/pagination";
import { toPaginatedResponse } from "../types/pagination";
import type { Review } from "../types/review";
import type { ParticipantsPreviewResponse } from "../types/participants";
import type { RecommendationItem, SimilarActivityItem } from "../types/recommendation";

/** ---------------------------
 *  GUIDE TEMPLATES
 *  ---------------------------
 */

export async function listMyTemplates() {
  const { data } = await http.get<ActivityTemplateResponse[]>(
    "/api/templates/mine",
    { withCredentials: true }
  );

  return data;
}

export async function listMyTemplatesPage(page = 0, size = 10) {
  const { data } = await http.get<ActivityTemplateResponse[] | PaginatedResponse<ActivityTemplateResponse>>(
    "/api/templates/mine",
    {
      params: { page, size },
      withCredentials: true,
    }
  );

  return toPaginatedResponse(data, page, size);
}

export async function getMyTemplate(id: string) {
  const { data } = await http.get<ActivityTemplateResponse>(
    `/api/templates/${id}`,
    { withCredentials: true }
  );

  return data;
}

// Backward-compatible alias for older pages/components.
export async function getTemplateById(id: string) {
  return getMyTemplate(id);
}

export async function createTemplate(body: ActivityTemplateCreatePayload) {
  const { data } = await http.post<ActivityTemplateResponse>(
    "/api/templates",
    body,
    { withCredentials: true }
  );

  return data;
}

export async function updateTemplate(
  id: string,
  body: ActivityTemplateUpdatePayload
) {
  const { data } = await http.patch<ActivityTemplateResponse>(
    `/api/templates/${id}`,
    body,
    { withCredentials: true }
  );

  return data;
}

export async function deleteTemplate(id: string) {
  const { data } = await http.delete<ActivityTemplateDeleteResponse>(
    `/api/templates/${id}`,
    { withCredentials: true }
  );

  return data;
}

export async function archiveTemplate(id: string) {
  const { data } = await http.patch<ActivityTemplateArchiveResponse>(
    `/api/templates/${id}/archive`,
    {},
    { withCredentials: true }
  );

  return data;
}

/** ---------------------------
 *  TEMPLATE IMAGES
 *  ---------------------------
 */

export type AddTemplateImageOptions = {
  cover?: boolean;
  alt?: string;
};

export async function addTemplateImage(
  id: string,
  file: File,
  options?: boolean | AddTemplateImageOptions,
  altFromOldSignature?: string
) {
  const form = new FormData();

  let cover = false;
  let alt: string | undefined;

  if (typeof options === "boolean") {
    // Old signature:
    // addTemplateImage(id, file, true, "Cover image")
    cover = options;
    alt = altFromOldSignature;
  } else if (options) {
    // Object signature:
    // addTemplateImage(id, file, { cover: true, alt: "Cover image" })
    cover = Boolean(options.cover);
    alt = options.alt;
  }

  form.append("file", file);
  form.append("cover", String(cover));

  if (alt && alt.trim()) {
    form.append("alt", alt.trim());
  }

  const { data } = await http.post<ActivityTemplateResponse>(
    `/api/templates/${id}/images`,
    form,
    {
      withCredentials: true,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return data;
}

export async function deleteTemplateImage(id: string, publicId: string) {
  const { data } = await http.delete<ActivityTemplateResponse>(
    `/api/templates/${id}/images`,
    {
      params: { publicId },
      withCredentials: true,
    }
  );

  return data;
}

export async function setTemplateCoverImage(id: string, publicId: string) {
  const { data } = await http.patch<ActivityTemplateResponse>(
    `/api/templates/${id}/images/cover`,
    null,
    {
      params: { publicId },
      withCredentials: true },
  );

  return data;
}

export async function reorderTemplateImages(
  id: string,
  publicIdsInOrder: string[]
) {
  const { data } = await http.patch<ActivityTemplateResponse>(
    `/api/templates/${id}/images/reorder`,
    publicIdsInOrder,
    { withCredentials: true }
  );

  return data;
}

/** ---------------------------
 *  GUIDE SESSIONS
 *  ---------------------------
 */

export async function listMySessions() {
  const { data } = await http.get<ActivitySessionResponse[]>(
    "/api/sessions/mine",
    { withCredentials: true }
  );

  return data;
}

export async function createSession(
  templateId: string,
  body: ActivitySessionCreatePayload
) {
  const { data } = await http.post<ActivitySessionResponse>(
    `/api/sessions/template/${templateId}`,
    body,
    { withCredentials: true }
  );

  return data;
}

export async function updateSession(
  id: string,
  body: ActivitySessionUpdatePayload
) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}`,
    body,
    { withCredentials: true }
  );

  return data;
}

export async function setSessionStatus(id: string, status: ActivityStatus) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}/status`,
    null,
    {
      params: { status },
      withCredentials: true,
    }
  );

  return data;
}

export async function setSessionPublished(id: string, published: boolean) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}/published`,
    null,
    {
      params: { published },
      withCredentials: true,
    }
  );

  return data;
}

export async function deleteOrCancelSession(id: string) {
  const { data } = await http.delete<ActivitySessionDeleteResponse>(
    `/api/sessions/${id}`,
    { withCredentials: true }
  );

  return data;
}

export async function getGuideSessionDetails(sessionId: string) {
  const { data } = await http.get<GuideSessionDetailsResponse>(
    `/api/sessions/${sessionId}/guide-details`,
    { withCredentials: true }
  );

  return data;
}

export async function getGuideTemplateSessionsDashboard(
  templateId: string,
  page = 0,
  size = 20
) {
  const { data } = await http.get<GuideTemplateSessionsDashboardResponse>(
    `/api/guides/templates/${templateId}/sessions-dashboard`,
    {
      params: { page, size },
      withCredentials: true,
    }
  );

  return data;
}

/** ---------------------------
 *  PUBLIC TEMPLATES
 *  ---------------------------
 */

export async function listPublicTemplates() {
  const { data } = await http.get<PublicTemplateCard[]>(
    "/api/templates/public",
    { withCredentials: true }
  );

  return data;
}

export async function listPublicTemplatesPage(page = 0, size = 12) {
  const { data } = await http.get<PublicTemplateCard[] | PaginatedResponse<PublicTemplateCard>>(
    "/api/templates/public",
    {
      params: { page, size },
      withCredentials: true,
    }
  );

  return toPaginatedResponse(data, page, size);
}

export async function getPublicTemplate(id: string) {
  const { data } = await http.get<PublicTemplateCard>(
    `/api/templates/public/${id}`,
    { withCredentials: true }
  );

  return data;
}

export async function listPublicSessions(templateId: string) {
  const { data } = await http.get<PublicSession[]>(
    `/api/templates/public/${templateId}/sessions`,
    { withCredentials: true }
  );

  return data;
}

export type TemplateSearchParams = {
  q?: string;
  addressId?: string;
  categoryIds?: string[];
  difficulty?: Difficulty;
  minPrice?: number;
  maxPrice?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
};

export async function searchPublicTemplates(params: TemplateSearchParams) {
  const { data } = await http.get<PublicTemplateCard[]>(
    "/api/templates/public/search",
    {
      params,
      withCredentials: true,
    }
  );

  return data;
}

export async function searchPublicTemplatesPage(
  params: TemplateSearchParams,
  page = 0,
  size = 12
) {
  const { data } = await http.get<PublicTemplateCard[] | PaginatedResponse<PublicTemplateCard>>(
    "/api/templates/public/search",
    {
      params: { ...params, page, size },
      withCredentials: true,
    }
  );

  return toPaginatedResponse(data, page, size);
}
export type AddressSuggestion = {
  id: string;
  displayName: string;
  governorate?: string | null;
  delegation?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  usesCount?: number | null;
};
export async function suggestPublicAddresses(q: string) {
  const { data } = await http.get<AddressSuggestion[]>(
    "/api/addresses/public/suggest",
    {
      params: { q },
      withCredentials: true,
    }
  );

  return data;
}

export async function getPublicTemplateById(id: string) {
  return getPublicTemplate(id);
}

export async function listPublicTemplateSessions(templateId: string) {
  return listPublicSessions(templateId);
}

export type PublicActivityReviewState = {
  myReview: Review | null;
  reviewEligible: boolean;
  alreadyReviewed: boolean;
  reviewId: string | null;
  reviewReason: string | null;
};

export type PublicActivityDetailsResponse = {
  template: PublicTemplateCard;
  upcomingSessions: PublicSession[];
  reviewsSummary: {
    average: number;
    count: number;
  };
  reviews: PaginatedResponse<Review>;
  currentUserReview: PublicActivityReviewState;
  participantsPreview: ParticipantsPreviewResponse | null;
  similarActivities: SimilarActivityItem[];
  recommendations: RecommendationItem[];
};

export async function getPublicActivityDetails(templateId: string) {
  const { data } = await http.get<PublicActivityDetailsResponse>(
    `/api/activities/public/${templateId}/details`,
    { withCredentials: true }
  );

  return data;
}

export async function restoreSession(id: string) {
  const { data } = await http.patch<ActivitySessionResponse>(
    `/api/sessions/${id}/restore`,
    null,
    { withCredentials: true }
  );

  return data;
}

export async function permanentlyDeleteSession(id: string) {
  const { data } = await http.delete<ActivitySessionDeleteResponse>(
    `/api/sessions/${id}/permanent`,
    { withCredentials: true }
  );

  return data;
}
