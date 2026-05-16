import { http } from "./http";
import type {
  ChatAssistantRequest,
  ChatAssistantResponse,
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

export async function chatWithAssistant(payload: ChatAssistantRequest): Promise<ChatAssistantResponse> {
  const { data } = await http.post<ChatAssistantResponse>(
    "/api/assistant/chat",
    payload,
    { withCredentials: true }
  );
  return data;
}
