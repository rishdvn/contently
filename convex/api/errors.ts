import { ConvexError } from "convex/values";

/*
  The API's failures, thrown from its internal functions and turned into HTTP
  answers by the router (`router.ts`). One shape everywhere:

      { "error": { "code": "not_found", "message": "…", "details": [...] } }
*/

export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "payload_too_large"
  | "unsupported_media"
  | "unavailable"
  | "no_render_worker"
  | "internal";

/* `retryAfter`, in seconds, becomes the answer's `Retry-After` header. */
export type ApiErrorData = { kind: "api"; code: ApiErrorCode; message: string; details?: { at: string; message: string }[]; retryAfter?: number };

export const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media: 415,
  rate_limited: 429,
  quota_exceeded: 429,
  internal: 500,
  unavailable: 503,
  no_render_worker: 503,
};

export function apiFail(code: ApiErrorCode, message: string, details?: ApiErrorData["details"], retryAfter?: number): never {
  throw new ConvexError({ kind: "api", code, message, ...(details?.length ? { details } : {}), ...(retryAfter !== undefined ? { retryAfter } : {}) } satisfies ApiErrorData);
}
