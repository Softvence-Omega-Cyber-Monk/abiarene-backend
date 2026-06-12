export function buildPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
) {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      count: data.length,
      totalPages: Math.ceil(total / limit),
    },
  };
}
