import { http } from "./http";
import type { Level } from "../types/auth";
import type { PaginatedResponse } from "../types/pagination";

export type GuideReviewStatus = "VISIBLE" | "HIDDEN";

export type GuideReviewReviewer = {
  id: string;
  username: string;
  profileImageUrl?: string | null;
  level?: Level | null;
};

export type GuideReview = {
  id: string;
  guideId: string;
  reviewerId: string;
  bookingId: string;
  sessionId: string;
  rating: number;
  comment: string;
  status: GuideReviewStatus;
  reviewer?: GuideReviewReviewer | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GuideReviewCreateRequest = {
  bookingId: string;
  rating: number;
  comment: string;
};

export type GuideReviewEligibility = {
  eligible: boolean;
  alreadyReviewed: boolean;
  existingReviewId?: string | null;
  reason?: string | null;
};

export async function createGuideReview(
  guideId: string,
  body: GuideReviewCreateRequest
): Promise<GuideReview> {
  const { data } = await http.post<GuideReview>(`/api/guides/${guideId}/reviews`, body, {
    withCredentials: true,
  });
  return data;
}

export async function listGuideReviews(
  guideId: string,
  page = 0,
  size = 10
): Promise<PaginatedResponse<GuideReview>> {
  const { data } = await http.get<PaginatedResponse<GuideReview>>(`/api/guides/${guideId}/reviews`, {
    params: { page, size },
  });
  return data;
}

export async function getGuideReviewEligibility(
  guideId: string,
  bookingId: string
): Promise<GuideReviewEligibility> {
  const { data } = await http.get<GuideReviewEligibility>(
    `/api/guides/${guideId}/reviews/eligibility`,
    {
      params: { bookingId },
      withCredentials: true,
    }
  );
  return data;
}
