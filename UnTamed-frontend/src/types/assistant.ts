export type GenerateActivityDraftRequest = {
  idea: string;
  targetAudience?: string;
  vibe?: string;
  notes?: string;
  durationPreference?: string;
  budgetStyle?: string;
  addressId?: string;
  placeLabel?: string;
};

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type GenerateActivityDraftResponse = {
  title: string;
  description: string;
  difficulty: Difficulty;

  tags: string[];
  semanticHints: string[];

  suggestedCategoryIds: string[];
  suggestedCategoryNames: string[];

  suggestedPriceMin: number | null;
  suggestedPriceMax: number | null;

  suggestedDurationMinutes: number | null;
  suggestedCapacity: number | null;

  highlights: string[];
  includedItems: string[];
  whatToBring: string[];

  warnings: string[];
  missingDetails: string[];

  meetingPointSuggestion: string | null;
  sessionNoteSuggestion: string | null;

  rationale: string | null;
};