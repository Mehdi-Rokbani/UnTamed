export type ReviewUser = {
  id: string;
  username: string;
  role: string; // "USER" | "GUIDE"
  profileImageUrl?: string | null;
};

export type Review = {
  id: string;
  activityTemplateId: string;
  sessionId: string;
  bookingId: string;

  reviewerId: string;
  guideId: string;

  reviewer?: ReviewUser | null;
  guide?: ReviewUser | null;

  rating: number;
  comment: string;
  status: "VISIBLE" | "HIDDEN";

  replyText?: string | null;
  replyCreatedAt?: string | null;
  replyUpdatedAt?: string | null;

  createdAt: string;
  updatedAt: string;
};

export type ReviewEligibility = {
  eligible: boolean;
  alreadyReviewed: boolean;
  existingReviewId?: string | null;
  activityTemplateId: string;
  reason: string;
};

export type CreateReviewRequest = {
  bookingId: string;
  rating: number;
  comment: string;
};

export type UpdateReviewRequest = {
  rating: number;
  comment: string;
};

export type ReplyReviewRequest = {
  replyText: string;
};