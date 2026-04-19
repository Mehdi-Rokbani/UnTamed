import { http } from "./http";
import type { RecommendationItem } from "../types/recommendation";
import type { SimilarActivityItem } from "../types/recommendation";

export async function getMyRecommendations(limit = 6) {
  const { data } = await http.get<RecommendationItem[]>("/api/recommendations/me", {
    params: { limit },
  });
  return data;
}

export async function getSimilarActivities(templateId: string, limit = 4) {
  const { data } = await http.get<SimilarActivityItem[]>(
    `/api/templates/${templateId}/similar`,
    {
      params: { limit },
    }
  );
  return data;
}