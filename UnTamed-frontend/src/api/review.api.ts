import { http } from "./http";
import type {
  Review,
  ReviewEligibility,
  CreateReviewRequest,
  UpdateReviewRequest,
  ReplyReviewRequest,
} from "../types/review";

export async function listTemplateReviews(templateId: string) {
  const { data } = await http.get<Review[]>(`/api/reviews/template/${templateId}`);
  return data;
}

export async function getMyReviewForTemplate(templateId: string) {
  const { data } = await http.get<Review>(`/api/reviews/me/template/${templateId}`);
  return data;
}

export async function getReviewEligibility(bookingId: string) {
  const { data } = await http.get<ReviewEligibility>(
    `/api/reviews/eligibility/booking/${bookingId}`
  );
  return data;
}

export async function createReview(payload: CreateReviewRequest) {
  const { data } = await http.post<Review>("/api/reviews", payload);
  return data;
}

export async function updateReview(reviewId: string, payload: UpdateReviewRequest) {
  const { data } = await http.put<Review>(`/api/reviews/${reviewId}`, payload);
  return data;
}

export async function replyToReview(reviewId: string, payload: ReplyReviewRequest) {
  const { data } = await http.put<Review>(`/api/reviews/${reviewId}/reply`, payload);
  return data;
}

export async function createReviewForTemplate(
  templateId: string,
  payload: { rating: number; comment: string }
) {
  const { data } = await http.post(`/api/reviews/template/${templateId}`, payload);
  return data;
}