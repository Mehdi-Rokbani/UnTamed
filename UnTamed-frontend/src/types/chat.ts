import type { PaginatedResponse } from "./pagination";

export type ChatRoom = {
  id: string;
  sessionId: string;
  templateId: string | null;
  guideId: string | null;
  activityTitle: string | null;
  activityImageUrl: string | null;
  participantCount: number;
  lastMessagePreview: string | null;
  lastMessageSenderName: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ChatRoomMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: "GUIDE" | "ADVENTURER" | string;
  avatarUrl: string | null;
  owner: boolean;
  joinedAt: string | null;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  sessionId: string;
  senderId: string | null;
  senderUsername: string | null;
  senderProfileImageUrl: string | null;
  senderRole: string | null;
  type?: "TEXT" | "SYSTEM" | null;
  message: string;
  mine: boolean;
  createdAt: string;
};

export type SendChatMessageRequest = {
  message: string;
};

export type ChatTypingEvent = {
  roomId: string;
  userId: string;
  username: string | null;
  typing: boolean;
  createdAt?: string | null;
};

export type ChatRoomMembershipEvent = {
  roomId: string;
  sessionId: string;
  userId: string;
  type: "REMOVED" | "ROOM_UPDATED";
  message: string | null;
  createdAt: string;
};

export type ChatRoomPreviewEvent = {
  roomId: string;
  sessionId: string;
  lastMessageId: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  lastMessageSenderName: string | null;
  lastMessageAt: string | null;
  participantCount: number | null;
  type: "MESSAGE_CREATED" | "ROOM_UPDATED" | "ROOM_REMOVED";
};

export type ChatRoomPageResponse = PaginatedResponse<ChatRoom>;
export type ChatMessagePageResponse = PaginatedResponse<ChatMessage>;
