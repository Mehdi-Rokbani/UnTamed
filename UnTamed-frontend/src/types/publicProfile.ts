import type { Level, Role } from "./auth";
import type { Difficulty, RatingSummary } from "./activity";

export type PublicTopCategory = {
  categoryId: string;
  categoryName: string;
  count: number;
};

export type PublicUserActivityReview = {
  id: string;
  activityTemplateId: string;
  activityTitle: string;
  activityImageUrl?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
};

export type PublicCertificate = {
  id?: string | null;
  title?: string | null;
  issuer?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verificationUrl?: string | null;
};

export type PublicUserGuideProfile = {
  verifiedBadge?: boolean | null;
  experienceYears?: number | null;
  ratingSummary?: RatingSummary | null;
  certificateCount?: number | null;
  certificates?: PublicCertificate[];
};

export type PublicGuideReview = {
  id: string;
  reviewerUsername?: string | null;
  reviewerProfileImageUrl?: string | null;
  reviewerLevel?: Level | null;
  reviewerLevelTitle?: string | null;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
};

export type PublicGuideActivityCard = {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  price?: number | null;
  difficulty?: Difficulty | null;
  categoryNames?: string[];
  location?: string | null;
  governorate?: string | null;
  rating?: RatingSummary | null;
};

export type PublicGuideStats = {
  activitiesCount: number;
  upcomingSessionsCount: number;
  totalReviewsCount: number;
  averageRating: number;
};

export type PublicUserProfile = {
  id: string;
  username: string;
  role: Role;
  profileImageUrl?: string | null;
  bio?: string | null;
  createdAt?: string | null;
  level?: Level | null;
  levelNumber?: number | null;
  levelTitle?: string | null;
  levelProgressPercent?: number | null;
  confirmedTripsCount?: number | null;
  reviewsWrittenCount?: number | null;
  topCategories?: PublicTopCategory[];
  recentReviews?: PublicUserActivityReview[];
  guideProfile?: PublicUserGuideProfile | null;
  guideReviews?: PublicGuideReview[];
  guideActivities?: PublicGuideActivityCard[];
  guideStats?: PublicGuideStats | null;
};
