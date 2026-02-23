export type Role = "USER" | "GUIDE" | "ADMIN";
export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: Role;

  enabled: boolean;
  createdAt: string;

  phoneNumber: string | null;
  bio: string | null;
  level: Level | null;
  preferences: string[];

  profileImageUrl: string | null;

  verified: boolean; // show badge (esp for guides)

  // keep suspended optional (only if backend returns it)
  suspended?: boolean;
};

export type LoginResponse =
  | { accessToken: string; user: AuthUser }
  | AuthUser;

export type RegisterResponse = AuthUser;

export type LoginRequest = { email: string; password: string };

export type RegisterRequest = {
  email: string;
  password: string;
  username: string;
  role: Role;
  level?: Level;
};
