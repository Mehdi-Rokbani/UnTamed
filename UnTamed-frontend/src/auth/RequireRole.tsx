import { type JSX } from "react";
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
  const allowed = allow.includes("ADVENTURER") && user?.role === "USER"
    ? true
    : !!user && allow.includes(user.role);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/403" replace />;

  return children;
}
