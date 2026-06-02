// src/auth/auth.store.tsx  (clean simplified AuthProvider; cookie-only)
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, Role } from "../types/auth";
import * as AuthApi from "../api/auth.api";
import { clearAccessToken } from "./accessToken";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;

  refreshMe: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;

  hasRole: (...roles: Role[]) => boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = () => {
    clearAccessToken();
    setUser(null);
  };

  const refreshMe = async () => {
    try {
      const me = await AuthApi.refreshSession();
      setUser(me);
    } catch {
      clear();
    }
  };

  const signIn = async (email: string, password: string) => {
    // ✅ backend sets cookies; body returns user
    const me = await AuthApi.login({ email, password });
    setUser(me);
    return me;
  };

  const signOut = async () => {
    try {
      await AuthApi.logout();
    } finally {
      clear();
    }
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    if (user.role === "USER" && roles.includes("ADVENTURER")) return true;
    return roles.includes(user.role);
  };

  // Bootstrap session on app start
  useEffect(() => {
    (async () => {
      await refreshMe();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to global event fired by http.ts when refresh fails
  useEffect(() => {
    const onExpired = () => clear();
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshMe, signIn, signOut, hasRole }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
