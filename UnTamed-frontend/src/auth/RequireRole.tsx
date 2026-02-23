import React, { type JSX } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "../types/auth";
import { useAuth } from "./auth.store";

export function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) return <Navigate to="/403" replace />;

  return children;
}
