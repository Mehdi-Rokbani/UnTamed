// src/types/activity.ts
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
   // optional for new address
  provider: string;
  providerPlaceId: string;
  displayName: string;
  governorate?: string | null;
  delegation?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ActivityCreatePayload = {
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;
  date: string;
  capacity: number;

  categoryIds: string[]; // ✅ REQUIRED

  tags?: string[];
  address: AddressPickDto;

  images?: ActivityImage[]; // optional for draft
};


export type ActivityUpdatePayload = Partial<ActivityCreatePayload> & {
  status?: ActivityStatus;
};

export type ActivityResponse = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  price: number;
  date: string;
  capacity: number;

  // legacy compatibility (backend sends this)
  published: boolean;

  guideId: string;
  addressId: string;
  address?: AddressResponse | null;

  bookedCount: number;
  tags: string[];
  rating: RatingSummary;
  status: ActivityStatus;

  images: ActivityImage[];
  categoryIds: string[];

  createdAt?: string | null;
  updatedAt?: string | null;
};
