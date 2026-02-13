export function successResponse<T>(
  data: T,
  options?: { status?: number; message?: string },
) {
  return Response.json(
    {
      data,
      ...(options?.message ? { message: options.message } : {}),
    },
    { status: options?.status ?? 200 },
  );
}

export function errorResponse(
  status: number,
  error: string,
  details?: unknown,
) {
  return Response.json(
    {
      error,
      ...(details ? { details } : {}),
    },
    { status },
  );
}
