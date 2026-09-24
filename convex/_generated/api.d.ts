/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audio_index from "../audio/index.js";
import type * as audio_library from "../audio/library.js";
import type * as audio_soundstripe from "../audio/soundstripe.js";
import type * as clerk_backfill from "../clerk/backfill.js";
import type * as clerk_mirror from "../clerk/mirror.js";
import type * as clerk_payloads from "../clerk/payloads.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as orgs from "../orgs.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "audio/index": typeof audio_index;
  "audio/library": typeof audio_library;
  "audio/soundstripe": typeof audio_soundstripe;
  "clerk/backfill": typeof clerk_backfill;
  "clerk/mirror": typeof clerk_mirror;
  "clerk/payloads": typeof clerk_payloads;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  orgs: typeof orgs;
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
