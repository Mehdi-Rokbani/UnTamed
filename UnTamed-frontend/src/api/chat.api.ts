import { http } from "./http";
import type { ChatMessage, ChatRoom } from "../types/chat";
import type { PaginatedResponse } from "../types/pagination";

export async function listChatRooms(
  page = 0,
  size = 20
): Promise<PaginatedResponse<ChatRoom>> {
  const { data } = await http.get<PaginatedResponse<ChatRoom>>("/api/chat/rooms", {
    params: { page, size },
  });
  return data;
}

export async function getSessionChatRoom(sessionId: string): Promise<ChatRoom> {
  const { data } = await http.get<ChatRoom>(`/api/chat/sessions/${sessionId}/room`);
  return data;
}

export async function listChatMessages(
  roomId: string,
  page = 0,
  size = 50
): Promise<PaginatedResponse<ChatMessage>> {
  const { data } = await http.get<PaginatedResponse<ChatMessage>>(
    `/api/chat/rooms/${roomId}/messages`,
    { params: { page, size } }
  );
  return data;
}

export async function sendChatMessage(roomId: string, message: string): Promise<ChatMessage> {
  const { data } = await http.post<ChatMessage>(`/api/chat/rooms/${roomId}/messages`, {
    message,
  });
  return data;
}
