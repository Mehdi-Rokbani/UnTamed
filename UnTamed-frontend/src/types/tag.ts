export type TagType =
  | "ACTIVITY"
  | "ENVIRONMENT"
  | "VIBE"
  | "EFFORT"
  | "REQUIREMENT"
  | "BUDGET"
  | "AI_SUGGESTED";

export type TagStatus = "APPROVED" | "AI_SUGGESTED" | "REJECTED";

export type Tag = {
  id: string;
  slug: string;
  name: string;
  type: TagType;
  status: TagStatus;
  synonyms: string[];
  active: boolean;
  aiSuggested: boolean;
  usageCount: number;
  sortOrder: number | null;
};
