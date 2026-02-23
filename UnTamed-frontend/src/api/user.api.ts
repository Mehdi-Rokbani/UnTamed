import { http } from "./http";
import type { AuthUser } from "../types/auth";

export type UpdateProfilePayload = {
  username?: string;
  phoneNumber?: string | null;
  bio?: string | null;
  preferences?: string[];
  level?: string | null; // USER only (backend rejects for GUIDE)
};

export async function getMe() {
  const { data } = await http.get<AuthUser>("/api/users/me");
  return data;
}

export async function updateMe(body: UpdateProfilePayload) {
  const { data } = await http.patch<AuthUser>("/api/users/me", body);
  return data;
}

/**
 * Upload profile picture (Cloudinary via backend)
 * Endpoint: PATCH /api/users/me/profile-picture
 * Form field name: "file"
 */
export async function uploadProfilePicture(file: File) {
  const form = new FormData();
  form.append("file", file);

  const { data } = await http.patch<AuthUser>("/api/users/me/profile-picture", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
