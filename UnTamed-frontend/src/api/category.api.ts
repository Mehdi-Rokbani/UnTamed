import { http } from "./http";
import type { Category } from "../types/category";

export async function listCategories(params?: { activeOnly?: boolean }) {
  const { data } = await http.get<Category[]>("/api/categories", {
    params: params?.activeOnly ? { active: true } : undefined,
  });
  return data;
}
