import { type JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth.store";
import { roleHome } from "./roleRouting";

export function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (user) return <Navigate to={roleHome(user.role)} replace />;

  return children;
}
