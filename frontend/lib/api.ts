export type ApiErrorBody = {
  code: string;
  message: string;
  field_errors?: Record<string, string[]> | null;
  request_id?: string;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = cookieValue("durisense_csrf");
    if (csrf) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) {
    if (!response.ok) throw new ApiError(response.status, { code: "HTTP_ERROR", message: "Request failed" });
    return undefined as unknown as T;
  }
  const body = await response.json();
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorBody);
  return body as T;
}
