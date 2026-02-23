// src/api/geo.api.ts
import { http } from "./http";
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
