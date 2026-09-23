const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** An HTTP error from the backend. `message` is the server's own explanation
 * ({"error": {"message"}}) when it sent one, so the UI can show something
 * useful instead of "failed: 409". */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  token: string | null,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let message = `API ${path} failed: ${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.error?.message === "string") message = body.error.message;
      if (typeof body?.error?.code === "string") code = body.error.code;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
