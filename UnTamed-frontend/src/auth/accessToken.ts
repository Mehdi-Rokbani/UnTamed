const ACCESS_TOKEN_KEY = "untamed.accessToken";

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token?: string | null) {
  inMemoryAccessToken = token?.trim() || null;

  if (typeof window === "undefined") return;
  if (inMemoryAccessToken) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, inMemoryAccessToken);
  } else {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window === "undefined") return null;

  const stored = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  inMemoryAccessToken = stored?.trim() || null;
  return inMemoryAccessToken;
}

export function clearAccessToken() {
  setAccessToken(null);
}
