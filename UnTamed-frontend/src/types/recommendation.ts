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