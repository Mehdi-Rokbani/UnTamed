import { http } from "./http";
import type { Notification } from "../types/notification";
import type { PaginatedResponse } from "../types/pagination";

export async function listNotifications(
  page = 0,
  size = 20
): Promise<PaginatedResponse<Notification>> {
  const { data } = await http.get<PaginatedResponse<Notification>>("/api/notifications", {
    params: { page, size },
  });
  return data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await http.get<{ count: number }>("/api/notifications/unread-count");
  return Number(data.count ?? 0);
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await http.patch<Notification>(`/api/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await http.patch("/api/notifications/read-all");
}

export async function deleteNotification(id: string): Promise<void> {
  await http.delete(`/api/notifications/${id}`);
}

export async function createTestNotification(title: string, message: string): Promise<Notification> {
  const { data } = await http.post<Notification>("/api/notifications/test", null, {
    params: { title, message },
  });
  return data;
}
