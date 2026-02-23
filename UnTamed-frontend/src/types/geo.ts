// src/types/geo.ts
export type AddressResponse = {
  id: string;
  provider: string;
  providerPlaceId: string;
  displayName: string;

  governorate?: string | null;
  delegation?: string | null;
  locality?: string | null;

  latitude: number;
  longitude: number;

  usesCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
