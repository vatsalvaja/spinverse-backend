export interface CreateGameCategoryData {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateGameCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface GameCategoryListFilter {
  /** Case-insensitive match on name or slug. */
  search?: string;
  isActive?: boolean;
}
