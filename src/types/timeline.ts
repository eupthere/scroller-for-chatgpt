export type Role = 'user' | 'assistant';

export interface ViewportArticle {
  id: string;
  role: Role | null;
  previewText?: string | null;
}
