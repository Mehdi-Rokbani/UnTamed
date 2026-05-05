export type PaginatedResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

export function toPaginatedResponse<T>(
  data: T[] | PaginatedResponse<T>,
  fallbackPage: number,
  fallbackSize: number
): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: fallbackPage,
      size: fallbackSize,
      totalElements: data.length,
      totalPages: data.length > 0 ? 1 : 0,
      last: true,
    };
  }

  return {
    content: data.content ?? [],
    page: data.page ?? fallbackPage,
    size: data.size ?? fallbackSize,
    totalElements: data.totalElements ?? data.content?.length ?? 0,
    totalPages: data.totalPages ?? 0,
    last: Boolean(data.last),
  };
}
