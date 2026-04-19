export type RecommendationItem = {
  templateId: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  categoryIds: string[];
  difficulty: string;
  price: number;
  ratingAverage: number;
  ratingCount: number;
  nextSessionDate: string | null;
  score: number;
  reasons: string[];
};
export type SimilarActivityItem = {
  templateId: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  categoryIds: string[];
  difficulty: string | null;
  price: number | null;
  ratingAverage: number;
  ratingCount: number;
  nextSessionDate: string | null;
  score: number;
  reasons: string[];
};