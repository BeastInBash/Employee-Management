const API_BASE_URL = import.meta.env.VITE_API_URL;

export class ApiRequestError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Give up (throw a non-ApiRequestError) when the server hasn't answered in this long. */
  timeoutMs?: number;
};

/**
 * Authenticated JSON request against the API. Throws `ApiRequestError` with the
 * server's `message` (or the first zod issue) on a non-2xx response.
 */
export async function api<T>(
  path: string,
  { method = "GET", body, query, timeoutMs }: RequestOptions = {},
): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, v);
  const qs = params.toString();

  const token = localStorage.getItem("authToken");
  const res = await fetch(`${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(timeoutMs && { signal: AbortSignal.timeout(timeoutMs) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = Array.isArray(data?.errors) ? data.errors[0]?.message : undefined;
    throw new ApiRequestError(res.status, issue ?? data?.message ?? "Something went wrong", data);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
