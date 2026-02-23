export type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  active: boolean;
  sortOrder: number;
};
