/**
 * Typed fetch client for the Project Sentinel API.
 *
 * - Reads the base URL from NEXT_PUBLIC_API_URL (default http://localhost:8000/api/v1).
 * - Attaches the Bearer token from the auth store.
 * - Returns the full success envelope; use {@link unwrap} to get `.data`.
 * - Throws {@link ApiRequestError} on non-2xx responses, carrying the parsed
 *   error envelope when available so UI can show `message` / `suggested_action`.
 */

import type { ApiEnvelope, ApiError } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/api/v1";

/** Error thrown for any non-2xx API response or transport failure. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly suggestedAction?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly details?: Record<string, any>;

  constructor(
    message: string,
    opts: {
      status: number;
      errorCode?: string;
      suggestedAction?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details?: Record<string, any>;
    },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = opts.status;
    this.errorCode = opts.errorCode ?? "unknown_error";
    this.suggestedAction = opts.suggestedAction;
    this.details = opts.details;
  }
}

function authHeader(): Record<string, string> {
  // Read directly from the store outside React — getState() is safe here.
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isErrorEnvelope(body: unknown): body is ApiError {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { status?: string }).status === "error"
  );
}

async function request<T>(
  path: string,
  init: RequestInit,
  opts: { rawBody?: boolean } = {},
): Promise<ApiEnvelope<T>> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        // FormData bodies must NOT set Content-Type — the browser adds the
        // multipart boundary itself.
        ...(opts.rawBody ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...authHeader(),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    // Network / backend-down: surface a friendly, typed error.
    throw new ApiRequestError(
      "Unable to reach the Sentinel backend. Is the API running?",
      { status: 0, errorCode: "network_error", details: { cause: String(err) } },
    );
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  if (!res.ok) {
    if (isErrorEnvelope(body)) {
      throw new ApiRequestError(body.message, {
        status: res.status,
        errorCode: body.error_code,
        suggestedAction: body.suggested_action,
        details: body.details,
      });
    }
    const message =
      (body as { message?: string })?.message ??
      `Request failed with status ${res.status}`;
    throw new ApiRequestError(message, { status: res.status });
  }

  return body as ApiEnvelope<T>;
}

/** GET an endpoint, returning the full success envelope. */
export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<ApiEnvelope<T>> {
  let full = path;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const query = qs.toString();
    if (query) full += `${path.includes("?") ? "&" : "?"}${query}`;
  }
  return request<T>(full, { method: "GET" });
}

/** POST a JSON body to an endpoint, returning the full success envelope. */
export function apiPost<T>(
  path: string,
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Convenience: GET and return only the `.data` payload. */
export async function apiGetData<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  return unwrap(await apiGet<T>(path, params));
}

/** Convenience: POST and return only the `.data` payload. */
export async function apiPostData<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return unwrap(await apiPost<T>(path, body));
}

/** POST a multipart FormData body (e.g. file upload), returning the full success envelope. */
export function apiPostForm<T>(
  path: string,
  form: FormData,
): Promise<ApiEnvelope<T>> {
  return request<T>(path, { method: "POST", body: form }, { rawBody: true });
}

/** Convenience: POST a multipart FormData body and return only the `.data` payload. */
export async function apiPostFormData<T>(
  path: string,
  form: FormData,
): Promise<T> {
  return unwrap(await apiPostForm<T>(path, form));
}

/** Extract the `data` field from a success envelope. */
export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data;
}
