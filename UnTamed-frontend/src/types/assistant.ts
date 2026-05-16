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
  warnings: string[];
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

export type ChatAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatAssistantRecommendation = {
  id: string;
  title: string;
  difficulty?: string | null;
  price?: number | string | null;
  location?: string | null;
  imageUrl?: string | null;
  reason?: string | null;
};

export type ChatAssistantRequest = {
  message: string;
  activityTemplateId?: string | null;
  sessionId?: string | null;
  pageContext?: string | null;
  history?: ChatAssistantMessage[];
};

export type ChatAssistantResponse = {
  answer: string;
  suggestedQuestions: string[];
  fallback: boolean;
  model: string;
  source: string;
  recommendations?: ChatAssistantRecommendation[];
};
