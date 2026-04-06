import { http } from "./http";
import type { ParticipantsPreviewResponse } from "../types/participants";

export async function getParticipantsPreview(sessionId: string) {
  const { data } = await http.get<ParticipantsPreviewResponse>(
    `/api/sessions/${sessionId}/participants-preview`
  );
  return data;
}