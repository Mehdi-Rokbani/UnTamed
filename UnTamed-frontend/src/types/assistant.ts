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
  warnings(warnings: any, arg1: number): unknown;
  title: string;
  description: string;
  difficulty: Difficulty;

  tags: string[];
  newTagSuggestions: string[];
  tagSuggestionsReason?: string[];

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

  safetyNotes: string[]; // ✅ renamed

  missingDetails: string[];

  meetingPointSuggestion: string | null;
  sessionNoteSuggestion: string | null;

  rationale: string | null;
  confidenceScore?: number;
};