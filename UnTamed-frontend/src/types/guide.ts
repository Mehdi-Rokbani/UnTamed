// src/types/guide.ts

export type RatingSummaryResponse = {
  average: number; // e.g. 4.7
  count: number;   // e.g. 132
};

export type CertificateResponse = {
  id: string;
  title: string;
  issuer: string;

  credentialId: string | null;

  issuedAt: string | null;   // ISO string from backend
  expiresAt: string | null;  // ISO string from backend

  verificationUrl: string | null;
  fileUrl: string | null;

  fileType: string | null;       // e.g. "application/pdf"
  fileSizeBytes: number | null;  // optional
};

export type GuideProfileResponse = {
  experienceYears: number | null;

  certificates: CertificateResponse[];

  ratingSummary: RatingSummaryResponse | null;
};

export type UpdateGuideProfileRequest = {
  experienceYears?: number | null;
};
export type Participant = {
  bookingId: string;
  userId: string;
  username: string | null;
  email: string | null;
  profileImageUrl: string | null;
  numberOfPeople: number;
  status: "PENDING" | "PAYING" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  totalAmount?: number;
  currency?: string | null;
  refundStatus?: string;
  refundPercent?: number;
  refundAmount?: number;
  refundCurrency?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
};
