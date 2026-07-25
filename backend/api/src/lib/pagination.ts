export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  /** true si el cliente envió page, limit, take o skip */
  explicit: boolean;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const explicit =
    query.page !== undefined ||
    query.limit !== undefined ||
    query.take !== undefined ||
    query.skip !== undefined;

  const limitRaw = query.limit ?? query.take ?? DEFAULT_LIMIT;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(limitRaw), 10) || DEFAULT_LIMIT),
  );

  if (query.skip !== undefined) {
    const skip = Math.max(0, parseInt(String(query.skip), 10) || 0);
    const page = Math.floor(skip / limit) + 1;
    return { page, limit, skip, explicit };
  }

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const skip = (page - 1) * limit;
  return { page, limit, skip, explicit };
}

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: Pick<PaginationParams, 'page' | 'limit'>,
): PaginatedResult<T> {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
