import { http } from "./http";
import type { ChatMessage, ChatRoom, ChatRoomMember } from "../types/chat";
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

export async function listChatRoomMembers(roomId: string): Promise<ChatRoomMember[]> {
  const { data } = await http.get<ChatRoomMember[]>(`/api/chat/rooms/${roomId}/members`);
  return data;
}

export async function leaveChatRoom(roomId: string): Promise<ChatRoom> {
  const { data } = await http.post<ChatRoom>(`/api/chat/rooms/${roomId}/leave`);
  return data;
}

export async function removeChatRoomMember(roomId: string, userId: string): Promise<ChatRoom> {
  const { data } = await http.delete<ChatRoom>(`/api/chat/rooms/${roomId}/members/${userId}`);
  return data;
}

export async function markChatRoomRead(roomId: string): Promise<ChatRoom> {
  const { data } = await http.post<ChatRoom>(`/api/chat/rooms/${roomId}/read`);
  return data;
}
