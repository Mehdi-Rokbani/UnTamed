export type GenerateActivityDraftRequest = {
  idea: string;
  place?: string;
  targetAudience?: string;
  vibe?: string;
  notes?: string;
};

export type GenerateActivityDraftResponse = {
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  semanticHints: string[];
};