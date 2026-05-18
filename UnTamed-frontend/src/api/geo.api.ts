// src/api/geo.api.ts
import { API_BASE_URL, http } from "./http";
import type { AddressResponse } from "../types/geo";

export async function geoAutocomplete(q: string, limit = 10) {
  const { data } = await http.get<AddressResponse[]>("/api/geo/autocomplete", {
    params: { q, limit },
  });
  return data;
}

export async function geoReverse(lat: number, lon: number, zoom = 18) {
  const { data } = await http.get<AddressResponse>("/api/geo/reverse", {
    params: { lat, lon, zoom },
  });
  return data;
}

export async function geoPopular() {
  const { data } = await http.get<AddressResponse[]>("/api/geo/popular");
  return data;
}

export function geoStaticMapUrl(
  lat: number,
  lon: number,
  label?: string | null,
  variant: "activity" | "meeting" = "activity"
) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    variant,
  });
  if (label?.trim()) params.set("label", label.trim());
  return `${API_BASE_URL}/api/geo/static-map?${params.toString()}`;
}
