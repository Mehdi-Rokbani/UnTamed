import type { AddressResponse } from "./geo";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type ActivityStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type RatingSummary = {
  average: number;
  count: number;
};

export type ActivityImage = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  cover: boolean;
  order: number;
};

export type AddressPickDto = {
  provider: string;
  providerPlaceId: string;
  displayName: string;
  governorate?: string | null;
  delegation?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** ---------------------------
 *  TEMPLATE (product, rated)
 *  ---------------------------
 */

export type ActivityTemplateCreatePayload = {
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;

  categoryIds: string[];

  tags?: string[];
  safetyNotes?: string[];
  address: AddressPickDto;

  images?: ActivityImage[];
};

export type ActivityTemplateUpdatePayload = Partial<ActivityTemplateCreatePayload>;

export type ActivityTemplateResponse = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;

  guideId: string;
  addressId: string;

  tags: string[];
  rating: RatingSummary;

  images: ActivityImage[];
  categoryIds: string[];

  createdAt?: string | null;
  updatedAt?: string | null;
};

/** ---------------------------
 *  SESSION
 *  ---------------------------
 */

export type ActivitySessionCreatePayload = {
  startAt: string; // ISO
  endAt: string; // ISO
  capacity: number;
  meetingPoint?: string;
  sessionNote?: string;
};

export type ActivitySessionUpdatePayload = {
  startAt?: string;
  endAt?: string;
  capacity?: number;
  status?: ActivityStatus;
  meetingPoint?: string;
  sessionNote?: string;
};

export type ActivityTemplateMini = {
  id: string;
  title: string;
  price: number;
  difficulty: Difficulty;
  guideId: string;
  tags?: string[] | null;
  coverImageUrl?: string | null;
};

export type ActivitySessionResponse = {
  id: string;
  templateId: string;
  guideId: string;

  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  status: ActivityStatus;
  meetingPoint?: string | null;
  sessionNote?: string | null;

  template?: ActivityTemplateMini | null;
  rating?: RatingSummary | null;
};

/** ---------------------------
 *  PUBLIC browse
 *  ---------------------------
 */

export type PublicNextSession = {
  id: string;
  startAt: string;
  capacity: number;
  bookedCount: number;
};

export type PublicSession = {
  id: string;
  startAt: string;
  capacity: number;
  bookedCount: number;
};

export type TemplateWithAddress = ActivityTemplateResponse & {
  address?: AddressResponse | null;
};

export type ActivityImageDto = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  cover: boolean;
  order: number;
};

export type PublicGuideDto = {
  id: string;
  username: string;
  profileImageUrl?: string | null;
  verifiedBadge: boolean;
  rating: RatingSummary;
  experienceYears?: number | null;
};

export type PublicTemplateCard = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;
  tags: string[];
  coverImageUrl?: string | null;
  rating: RatingSummary;
  nextSession?: PublicNextSession | null;
  upcomingSessionsCount: number;
  images: ActivityImageDto[];
  addressDisplayName?: string | null;
  governorate?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  totalBookedCount: number;
  guide?: PublicGuideDto | null;
};