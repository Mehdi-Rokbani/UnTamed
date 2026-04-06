export type ParticipantPreviewItem = {
  userId: string;
  username: string;
  profileImageUrl: string | null;
  level: string | null;
};

export type ParticipantsPreviewResponse = {
  totalConfirmed: number;
  seatsLeft: number;
  participants: ParticipantPreviewItem[];
};