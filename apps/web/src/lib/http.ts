import { getIdToken } from "./firebase.ts";
import { useAuthStore } from "../features/auth/store.ts";

// Empty/undefined env → root-relative paths (same-origin, behind Firebase Hosting).
// Otherwise use the explicit URL (e.g. http://localhost:8080 in dev).
const BASE =
  import.meta.env.VITE_API_BASE_URL === undefined
    ? "http://localhost:8080"
    : import.meta.env.VITE_API_BASE_URL;

export interface ApiErrorBody {
  code: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Don't auto-attach Firebase ID token */
  anonymous?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, query, anonymous, headers: hdrs, ...rest } = opts;

  let url = `${BASE}${path}`;
  if (query) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) search.set(k, String(v));
    }
    const s = search.toString();
    if (s) url += `?${s}`;
  }

  const headers = new Headers(hdrs);
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!anonymous) {
    let token: string | null = null;
    try {
      token = await getIdToken();
    } catch {
      // Firebase not initialized (dev mode with no project). MSW handlers
      // ignore Authorization, so just proceed without a token.
    }
    // In dev with MSW we still want to send *something* so the api side dev-token shortcut works
    // for any non-MSW curls; doesn't matter since MSW intercepts before fetch.
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else if (import.meta.env.DEV) headers.set("Authorization", "Bearer dev-token");

    const googleToken = useAuthStore.getState().googleAccessToken;
    if (googleToken) headers.set("X-Google-Access-Token", googleToken);
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. Cloud Run gateway 404 HTML page) — don't crash.
      json = { code: "non-json-response", message: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    const body =
      json && typeof json === "object"
        ? (json as ApiErrorBody)
        : { code: "unknown", message: `HTTP ${res.status}` };
    throw new ApiError(res.status, body);
  }
  return json as T;
}
