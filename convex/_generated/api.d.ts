/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clerk_backfill from "../clerk/backfill.js";
import type * as clerk_mirror from "../clerk/mirror.js";
import type * as clerk_payloads from "../clerk/payloads.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as media from "../media.js";
import type * as orgs from "../orgs.js";
import type * as projects from "../projects.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "clerk/backfill": typeof clerk_backfill;
  "clerk/mirror": typeof clerk_mirror;
  "clerk/payloads": typeof clerk_payloads;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  media: typeof media;
  orgs: typeof orgs;
  projects: typeof projects;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
