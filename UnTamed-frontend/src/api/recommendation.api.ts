import { http } from "./http";
import type { RecommendationItem } from "../types/recommendation";

export async function getMyRecommendations(limit = 6) {
  const { data } = await http.get<RecommendationItem[]>("/api/recommendations/me", {
    params: { limit },
  });
  return data;
}