import { http } from "./http";
import type {
  GenerateActivityDraftRequest,
  GenerateActivityDraftResponse,
} from "../types/assistant";

export async function generateActivityDraft(body: GenerateActivityDraftRequest) {
  const { data } = await http.post<GenerateActivityDraftResponse>(
    "/api/assistant/activity-draft",
    body,
    { withCredentials: true }
  );
  return data;
}