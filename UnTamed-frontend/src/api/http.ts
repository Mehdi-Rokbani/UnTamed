// src/api/http.ts  (cookie-only)
import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ send HttpOnly cookies
});

// Bare client (no interceptors) to avoid recursion during refresh
const bare = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// ✅ Request interceptor: set JSON header only for non-FormData bodies
http.interceptors.request.use((config) => {
  const data: any = (config as any).data;

  config.headers = config.headers ?? {};

  if (data instanceof FormData) {
    // Let browser set multipart boundary automatically
    delete (config.headers as any)["Content-Type"];
    delete (config.headers as any)["content-type"];
  } else {
    // Default to JSON for normal requests
    (config.headers as any)["Content-Type"] = "application/json";
  }

  return config;
});

let isRefreshing = false;
let refreshWaiters: Array<(ok: boolean) => void> = [];

function notifyRefreshWaiters(ok: boolean) {
  for (const fn of refreshWaiters) fn(ok);
  refreshWaiters = [];
}

function waitForRefresh(): Promise<boolean> {
  return new Promise((resolve) => refreshWaiters.push(resolve));
}

function isAuthUrl(url?: string) {
  if (!url) return false;
  return (
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/logout") ||
    url.includes("/api/auth/register")
  );
}

function emitAuthExpired() {
  window.dispatchEvent(new Event("auth:expired"));
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    const status = error.response?.status;
    const original =
      error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;

    // If access cookie expired -> 401 -> refresh once -> retry
    if (status === 401 && original && !original._retry && !isAuthUrl(original.url)) {
      original._retry = true;

      // If a refresh is in-flight, wait and retry after it
      if (isRefreshing) {
        const ok = await waitForRefresh();
        if (ok) return http(original);
        emitAuthExpired();
        return Promise.reject(new Error("Session expired"));
      }

      isRefreshing = true;
      try {
        // bare client should send JSON by default only when needed.
        // here body is null so no Content-Type is required
        await bare.post("/api/auth/refresh", null);
        notifyRefreshWaiters(true);
        return http(original);
      } catch {
        notifyRefreshWaiters(false);
        emitAuthExpired();
        return Promise.reject(new Error("Session expired"));
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 401 && isAuthUrl(original?.url)) {
      emitAuthExpired();
    }

    // Normalize error
    const data = error.response?.data;
    const msg =
      (typeof data === "string" && data) ||
      data?.message ||
      data?.error ||
      error.message ||
      "Request failed";

    return Promise.reject(new Error(`HTTP ${status ?? "?"}: ${msg}`));
  }
);
