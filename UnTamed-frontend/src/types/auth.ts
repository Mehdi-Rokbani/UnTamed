export type Role = "ADVENTURER" | "USER" | "GUIDE" | "ADMIN";

export type Level =
  | "BEGINNER"
  | "AMATEUR"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "EXPERT"
  | "LEGEND";

export type Certificate = {
  id?: string;
  title?: string;
  issuer?: string | null;
  credentialId?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  verificationUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
};

export type AuthGuideProfile = {
  verifiedBadge?: boolean;
  certificates?: Certificate[];
  certificateCount?: number;
  ratingSummary?: {
    average?: number;
    count?: number;
  };
  experienceYears?: number;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: Role;

  enabled: boolean;
  createdAt: string;

  phoneNumber: string | null;
  confirmedTripsCount: number;
  reviewsWrittenCount: number;
  bio: string | null;

  level: Level | null;
  xp?: number;
  levelNumber?: number;
  levelTitle?: string | null;
  xpToNextLevel?: number;
  levelProgressPercent?: number;

  preferences: string[];

  profileImageUrl: string | null;

  verified: boolean; // account/email verification only
  guideProfile?: AuthGuideProfile | null;

  // keep suspended optional only if backend returns it
  suspended?: boolean;
};

export type LoginResponse =
  | { accessToken: string; user: AuthUser }
  | AuthUser;

export type RegisterResponse = AuthUser;

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  username: string;
  role: Role;
  level?: Level;
};
