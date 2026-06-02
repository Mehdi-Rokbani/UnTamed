import type { Role } from "../types/auth";

export function normalizedRole(role?: Role | null): Role | null {
  return role === "USER" ? "ADVENTURER" : role ?? null;
}

export function roleHome(role?: Role | null): string {
  switch (normalizedRole(role)) {
    case "ADMIN":
      return "/admin";
    case "GUIDE":
      return "/guide";
    case "ADVENTURER":
      return "/home";
    default:
      return "/";
  }
}
