// src/api/auth.api.ts  (cookie-only)
import { http } from "./http";
import type { AuthUser, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from "../types/auth";
import { clearAccessToken, setAccessToken } from "../auth/accessToken";

/**
 * Cookie-only contract:
 * - login sets HttpOnly cookies and returns user (UserResponse)
 * - refresh is handled by http.ts interceptor
 * - me reads cookie-auth and returns user
 * - logout clears cookies server-side
 */

export async function login(body: LoginRequest): Promise<AuthUser> {
  const { data } = await http.post<LoginResponse>("/api/auth/login", body);
  if ("accessToken" in data) {
    setAccessToken(data.accessToken);
    return data.user;
  }
  clearAccessToken();
  return data;
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await http.post<RegisterResponse>("/api/auth/register", body);
  return data;
}

export async function verifyEmail(token: string): Promise<void> {
  await http.post("/api/auth/verify-email", { token });
}

export async function resendVerification(email: string): Promise<void> {
  await http.post("/api/auth/resend-verification", { email });
}

// Your new location after moving from AuthController -> UserController
export async function me(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>("/api/users/me");
  return data;
}

export async function updateMe(body: any): Promise<AuthUser> {
  const { data } = await http.patch<AuthUser>("/api/users/me", body);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await http.post("/api/auth/logout");
  } finally {
    clearAccessToken();
  }
}
export async function usernameAvailable(username: string): Promise<boolean> {
  const { data } = await http.get<{ available: boolean }>(
    "/api/auth/available/username",
    { params: { u: username } }
  );
  return !!data.available;
}

export async function emailAvailable(email: string): Promise<boolean> {
  const { data } = await http.get<{ available: boolean }>(
    "/api/auth/available/email",
    { params: { e: email } }
  );
  return !!data.available;
}
