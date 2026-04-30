import { http } from "./http";
import type { Tag, TagType } from "../types/tag";

export async function listTags(type?: TagType) {
  const { data } = await http.get<Tag[]>("/api/tags", {
    params: type ? { type } : undefined,
  });

  return data;
}