import { http } from "./http";
import type { AuthUser, Level } from "../types/auth";
import type { PaginatedResponse } from "../types/pagination";
import type { PublicUserProfile } from "../types/publicProfile";

export type UpdateProfilePayload = {
  username?: string;
  phoneNumber?: string | null;
  bio?: string | null;
  preferences?: string[];
  level?: string | null; // Adventurer only (backend rejects for GUIDE)
};

export type ProfileTripAttendanceSummary = {
  totalPasses: number;
  present: number;
  absent: number;
  notMarked: number;
  cancelled: number;
};

export type ProfileCompletedTrip = {
  bookingId: string;
  sessionId: string;
  templateId: string | null;
  activityTitle: string;
  activityImageUrl?: string | null;
  addressDisplayName?: string | null;
  governorate?: string | null;
  categoryIds: string[];
  categoryNames: string[];
  sessionStartAt?: string | null;
  sessionEndAt?: string | null;
  numberOfPeople: number;
  bookingStatus: string;
  attendanceSummary?: ProfileTripAttendanceSummary | null;
  reviewEligible: boolean;
  alreadyReviewed: boolean;
  reviewId?: string | null;
};

export type ProfileReview = {
  reviewId: string;
  bookingId?: string | null;
  templateId: string;
  activityTitle: string;
  activityImageUrl?: string | null;
  governorate?: string | null;
  rating: number;
  comment: string;
  createdAt?: string | null;
};

export type ProfileTopCategory = {
  categoryId: string;
  categoryName: string;
  count: number;
};

export type ProfileActivitySummary = {
  completedTripsCount: number;
  reviewsCount: number;
  favoriteCategory?: string | null;
  totalPeople: number;
  level?: Level | null;
  xp?: number;
  levelNumber?: number;
  levelTitle?: string | null;
  xpToNextLevel?: number;
  levelProgressPercent?: number;
};

export type ProfileActivityFeed = {
  completedTrips: PaginatedResponse<ProfileCompletedTrip>;
  reviews: PaginatedResponse<ProfileReview>;
  topCategories: ProfileTopCategory[];
  summary: ProfileActivitySummary;
};

export type ProfileActivityFeedParams = {
  tripsPage?: number;
  tripsSize?: number;
  reviewsPage?: number;
  reviewsSize?: number;
};

export async function getMe() {
  const { data } = await http.get<AuthUser>("/api/users/me");
  return data;
}

export async function updateMe(body: UpdateProfilePayload) {
  const { data } = await http.patch<AuthUser>("/api/users/me", body);
  return data;
}

/**
 * Upload profile picture (Cloudinary via backend)
 * Endpoint: PATCH /api/users/me/profile-picture
 * Form field name: "file"
 */
export async function uploadProfilePicture(file: File) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await http.patch<AuthUser>("/api/users/me/profile-picture", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getMyActivityFeed(params: ProfileActivityFeedParams = {}) {
  const { data } = await http.get<ProfileActivityFeed>("/api/users/me/activity-feed", {
    params: {
      tripsPage: params.tripsPage ?? 0,
      tripsSize: params.tripsSize ?? 10,
      reviewsPage: params.reviewsPage ?? 0,
      reviewsSize: params.reviewsSize ?? 10,
    },
  });
  return data;
}

export async function getPublicUserProfile(userId: string) {
  const { data } = await http.get<PublicUserProfile>(`/api/users/${userId}/public-profile`, {
    withCredentials: true,
  });
  return data;
}
