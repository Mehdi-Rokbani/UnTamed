import React, { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.store";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  return children;
}
