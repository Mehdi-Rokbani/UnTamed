import { http } from "./http";
import type { PaginatedResponse } from "../types/pagination";
import { toPaginatedResponse } from "../types/pagination";

export type SemanticSearchRequest = {
  query: string;
  limit?: number;
  categoryId?: string;
  difficulty?: string;
  minPrice?: number;
  maxPrice?: number;

  // ✅ NEW
  addressId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "popular" | "soonest" | "priceAsc" | "priceDesc";
};

export type SemanticSearchItem = {
  templateId: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  categoryIds: string[];
  difficulty: string | null;
  price: number | null;
  ratingAverage: number;
  ratingCount: number;
  nextSessionDate: string | null;
  score: number;
  reasons: string[];
};

export async function semanticSearch(body: SemanticSearchRequest) {
  const { data } = await http.post<SemanticSearchItem[]>("/api/search/semantic", body);
  return data;
}

export async function semanticSearchPage(
  body: SemanticSearchRequest,
  page = 0,
  size = 12
) {
  const { data } = await http.post<SemanticSearchItem[] | PaginatedResponse<SemanticSearchItem>>(
    "/api/search/semantic",
    body,
    { params: { page, size } }
  );

  return toPaginatedResponse(data, page, size);
}
