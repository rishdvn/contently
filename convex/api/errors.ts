import { ConvexError } from "convex/values";

/*
  The API's failures, thrown from its internal functions and turned into HTTP
  answers by the router (`router.ts`). One shape everywhere:

      { "error": { "code": "not_found", "message": "…", "details": [...] } }
*/

export type ApiErrorCode = "invalid_request" | "unauthorized" | "not_found" | "rate_limited" | "payload_too_large" | "unavailable" | "internal";

export type ApiErrorData = { kind: "api"; code: ApiErrorCode; message: string; details?: { at: string; message: string }[] };

export const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  not_found: 404,
  payload_too_large: 413,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
};

export function apiFail(code: ApiErrorCode, message: string, details?: ApiErrorData["details"]): never {
  throw new ConvexError({ kind: "api", code, message, ...(details?.length ? { details } : {}) } satisfies ApiErrorData);
}
